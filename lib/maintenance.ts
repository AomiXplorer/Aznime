import crypto from 'node:crypto';
import {
  BYPASS_COOKIE_NAME,
  BYPASS_HINT_COOKIE_NAME,
  DEFAULT_MAINTENANCE_MESSAGE,
} from './maintenance-constants';

const MAINTENANCE_STATE_KEY = 'aznime:maintenance:state';
const MAINTENANCE_PENDING_PREFIX = 'aznime:maintenance:pending:';
const CACHE_TTL_MS = 5_000;
const PENDING_TTL_SECONDS = 300;
const DEFAULT_BYPASS_TTL_SECONDS = 12 * 60 * 60;
const MAX_DURATION_MINUTES = 7 * 24 * 60;

export { BYPASS_COOKIE_NAME, BYPASS_HINT_COOKIE_NAME, DEFAULT_MAINTENANCE_MESSAGE };

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  startedAt: string | null;
  endsAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface PendingMaintenanceAction {
  id: string;
  action: 'enable' | 'disable';
  durationMinutes: number | null;
  message: string;
  requestedBy: string;
  chatId: number;
  createdAt: string;
}

interface MemoryStore {
  state: MaintenanceState | null;
  pending: Map<string, { value: PendingMaintenanceAction; expiresAt: number }>;
  cache: { state: MaintenanceState; expiresAt: number } | null;
  ephemeralSecret: string | null;
}

const globalForMaintenance = globalThis as typeof globalThis & {
  __aznimeMaintenanceStore?: MemoryStore;
};

function getMemoryStore(): MemoryStore {
  if (!globalForMaintenance.__aznimeMaintenanceStore) {
    globalForMaintenance.__aznimeMaintenanceStore = {
      state: null,
      pending: new Map(),
      cache: null,
      ephemeralSecret: null,
    };
  }
  return globalForMaintenance.__aznimeMaintenanceStore;
}

export function defaultMaintenanceState(): MaintenanceState {
  return {
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    startedAt: null,
    endsAt: null,
    updatedBy: null,
    updatedAt: null,
  };
}

function normalizeState(raw: Partial<MaintenanceState> | null | undefined): MaintenanceState {
  const base = defaultMaintenanceState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    enabled: Boolean(raw.enabled),
    message:
      typeof raw.message === 'string' && raw.message.trim()
        ? raw.message.trim().slice(0, 500)
        : base.message,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null,
    endsAt: typeof raw.endsAt === 'string' ? raw.endsAt : null,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
}

export interface MaintenanceDiagnostics {
  upstashConfigured: boolean;
  upstashInvalidScheme: boolean;
  telegramBotTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  adminIdsCount: number;
  bypassSecretConfigured: boolean;
}

export function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || '';
  return Boolean(token && /^https?:\/\//i.test(url));
}

export function getMaintenanceDiagnostics(): MaintenanceDiagnostics {
  const rawUpstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || '';
  const upstashInvalidScheme = Boolean(rawUpstashUrl && !/^https?:\/\//i.test(rawUpstashUrl));

  return {
    upstashConfigured: isUpstashConfigured(),
    upstashInvalidScheme,
    telegramBotTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
    webhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim()),
    adminIdsCount: parseAdminIds().size,
    bypassSecretConfigured: Boolean(process.env.MAINTENANCE_BYPASS_SECRET?.trim()),
  };
}

async function upstashCommand<T = unknown>(command: (string | number)[]): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  if (!/^https?:\/\//i.test(url)) {
    console.error(
      '[Maintenance] UPSTASH_REDIS_REST_URL harus berupa URL HTTPS REST (https://...upstash.io), bukan URL Redis TCP.'
    );
    return null;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(2500),
  });

  if (!res.ok) {
    throw new Error(`Upstash REST error (${res.status})`);
  }

  const data = (await res.json()) as { result?: T; error?: string };
  if (data.error) {
    throw new Error(data.error);
  }
  return (data.result ?? null) as T | null;
}

export function invalidateMaintenanceCache(): void {
  getMemoryStore().cache = null;
}

export async function getMaintenanceState(options?: { bypassCache?: boolean }): Promise<MaintenanceState> {
  const store = getMemoryStore();
  const now = Date.now();

  if (!options?.bypassCache && store.cache && store.cache.expiresAt > now) {
    return store.cache.state;
  }

  if (isUpstashConfigured()) {
    try {
      const raw = await upstashCommand<string | null>(['GET', MAINTENANCE_STATE_KEY]);
      const parsed = raw ? (JSON.parse(raw) as Partial<MaintenanceState>) : null;
      const state = normalizeState(parsed);
      store.cache = { state, expiresAt: now + CACHE_TTL_MS };
      return state;
    } catch {
      if (store.cache) return store.cache.state;
      return normalizeState(store.state);
    }
  }

  const state = normalizeState(store.state);
  store.cache = { state, expiresAt: now + CACHE_TTL_MS };
  return state;
}

export async function setMaintenanceState(next: MaintenanceState): Promise<MaintenanceState> {
  const normalized = normalizeState(next);
  const store = getMemoryStore();
  store.state = normalized;
  store.cache = { state: normalized, expiresAt: Date.now() + CACHE_TTL_MS };

  if (isUpstashConfigured()) {
    await upstashCommand(['SET', MAINTENANCE_STATE_KEY, JSON.stringify(normalized)]);
  }

  return normalized;
}

export async function savePendingAction(
  action: Omit<PendingMaintenanceAction, 'id' | 'createdAt'>
): Promise<PendingMaintenanceAction> {
  const id = randomHex(8);
  const record: PendingMaintenanceAction = {
    ...action,
    id,
    createdAt: new Date().toISOString(),
  };
  const key = `${MAINTENANCE_PENDING_PREFIX}${id}`;

  if (isUpstashConfigured()) {
    await upstashCommand(['SET', key, JSON.stringify(record), 'EX', PENDING_TTL_SECONDS]);
    return record;
  }

  const store = getMemoryStore();
  pruneExpiredPending(store);
  store.pending.set(id, {
    value: record,
    expiresAt: Date.now() + PENDING_TTL_SECONDS * 1000,
  });
  return record;
}

export async function consumePendingAction(id: string): Promise<PendingMaintenanceAction | null> {
  if (!/^[a-f0-9]{8,32}$/i.test(id)) return null;
  const key = `${MAINTENANCE_PENDING_PREFIX}${id}`;

  if (isUpstashConfigured()) {
    const raw = await upstashCommand<string | null>(['GET', key]);
    if (!raw) return null;
    await upstashCommand(['DEL', key]).catch(() => null);
    try {
      return JSON.parse(raw) as PendingMaintenanceAction;
    } catch {
      return null;
    }
  }

  const store = getMemoryStore();
  pruneExpiredPending(store);
  const entry = store.pending.get(id);
  if (!entry) return null;
  store.pending.delete(id);
  return entry.expiresAt > Date.now() ? entry.value : null;
}

export async function deletePendingAction(id: string): Promise<void> {
  if (!/^[a-f0-9]{8,32}$/i.test(id)) return;
  if (isUpstashConfigured()) {
    await upstashCommand(['DEL', `${MAINTENANCE_PENDING_PREFIX}${id}`]).catch(() => null);
    return;
  }
  getMemoryStore().pending.delete(id);
}

function pruneExpiredPending(store: MemoryStore) {
  const now = Date.now();
  for (const [k, v] of store.pending.entries()) {
    if (v.expiresAt <= now) store.pending.delete(k);
  }
}

export function parseDurationMinutes(token: string): number | null {
  const match = token.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(m|min|menit|h|j|jam|d|hari)$/);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2];
  let minutes = amount;
  if (unit === 'h' || unit === 'j' || unit === 'jam') {
    minutes = amount * 60;
  } else if (unit === 'd' || unit === 'hari') {
    minutes = amount * 1440;
  }

  const rounded = Math.round(minutes);
  if (rounded < 1) return 1;
  return Math.min(rounded, MAX_DURATION_MINUTES);
}

export function parseMaintenanceOnArgs(rawArgs: string): {
  durationMinutes: number | null;
  message: string;
} {
  const trimmed = rawArgs.trim();
  if (!trimmed) {
    return { durationMinutes: null, message: '' };
  }

  const parts = trimmed.split(/\s+/);
  const firstDuration = parseDurationMinutes(parts[0] || '');
  if (firstDuration !== null) {
    return {
      durationMinutes: firstDuration,
      message: parts.slice(1).join(' ').trim().slice(0, 500),
    };
  }

  return {
    durationMinutes: null,
    message: trimmed.slice(0, 500),
  };
}

export function formatDurationLabel(minutes: number | null): string {
  if (!minutes || minutes <= 0) return 'Tanpa batas waktu';
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} jam` : `${hours} jam ${rem} menit`;
}

export function computeRetryAfterSeconds(endsAt: string | null, nowMs = Date.now()): number {
  if (!endsAt) return 300;
  const targetMs = Date.parse(endsAt);
  if (!Number.isFinite(targetMs)) return 300;
  const diffSec = Math.ceil((targetMs - nowMs) / 1000);
  if (diffSec <= 0) return 120;
  return Math.min(Math.max(diffSec, 60), 86_400);
}

export function parseAdminIds(raw = process.env.TELEGRAM_ADMIN_IDS): Set<number> {
  const ids = new Set<number>();
  if (!raw) return ids;
  for (const part of raw.split(',')) {
    const num = Number(part.trim());
    if (Number.isSafeInteger(num) && num !== 0) {
      ids.add(num);
    }
  }
  return ids;
}

export function isAuthorizedTelegramAdmin(userId?: number | null, chatId?: number | null): boolean {
  const admins = parseAdminIds();
  if (admins.size === 0) return false;
  if (typeof userId === 'number' && admins.has(userId)) return true;
  if (typeof chatId === 'number' && admins.has(chatId)) return true;
  return false;
}

function getSigningSecret(): string {
  const configured = process.env.MAINTENANCE_BYPASS_SECRET?.trim();
  if (configured) return configured;

  const store = getMemoryStore();
  if (!store.ephemeralSecret) {
    store.ephemeralSecret = randomHex(32);
  }
  return store.ephemeralSecret;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
}

export async function createBypassToken(
  ttlSeconds = DEFAULT_BYPASS_TTL_SECONDS,
  nowSec = Math.floor(Date.now() / 1000)
): Promise<string> {
  const exp = String(nowSec + Math.max(60, ttlSeconds));
  const sig = await signPayload(exp, getSigningSecret());
  return `${exp}.${sig}`;
}

export async function verifyBypassToken(
  token: string | undefined | null,
  nowSec = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return false;
  const [expRaw, sigRaw] = parts;
  if (!/^\d+$/.test(expRaw) || !/^[A-Za-z0-9_-]+$/.test(sigRaw)) return false;

  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exp) || exp <= nowSec) return false;

  const expectedSig = await signPayload(expRaw, getSigningSecret());
  return timingSafeEqualString(sigRaw, expectedSig);
}
