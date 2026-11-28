import { existsSync } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Backup lewat bot Telegram.
 *
 * Dua sumber berkas:
 *   1. repo  — arsip ZIP branch main dari GitHub (codeload). Isinya kode repo
 *              apa adanya, tanpa node_modules karena GitHub tidak menyimpannya.
 *   2. panel — arsip tar.gz isi server Pterodactyl, dibaca langsung dari dalam
 *              container tempat aplikasi ini berjalan: skrip start, pengawas
 *              rilis, folder shared (runtime.env, release.json), dan rilis yang
 *              sedang aktif.
 *
 * Arsip panel sengaja dibentuk sendiri di sini, bukan lewat API file panel:
 * API itu sedang menjawab DaemonConnectionException, dan membentuk arsip di
 * dalam container membuat isinya pasti sama dengan yang benar-benar dipakai.
 * node_modules, .next, .git, dan cache npm tidak pernah ikut, sesuai permintaan.
 *
 * Berkas dikirim sebagai dokumen Telegram, jadi ukurannya dibatasi 45 MB
 * (batas bot Telegram 50 MB). Kalau arsip lebih besar, bot melapor gagal
 * dengan angka aslinya daripada mengirim berkas yang ditolak Telegram.
 */

export type BackupKind = 'repo' | 'panel';

export interface BackupFile {
  kind: BackupKind;
  filename: string;
  data: Buffer;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const REPO_ZIP_URL = 'https://codeload.github.com/AomiXplorer/Aznime/zip/refs/heads/main';

/** Batas aman di bawah 50 MB milik Bot API Telegram. */
const MAX_DELIVERY_BYTES = 45 * 1024 * 1024;
/** Jaring pengaman supaya tidak membaca direktori raksasa tanpa henti. */
const MAX_SOURCE_BYTES = 400 * 1024 * 1024;

/** Direktori yang tidak pernah ikut: dependensi, hasil build, dan cache. */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.turbo',
  'npm-cache',
  'bin',
  '.vercel',
  'coverage',
]);

const EXCLUDED_FILES = new Set(['.DS_Store', 'tsconfig.tsbuildinfo']);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    '-',
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
  ].join('');
}

interface TarEntry {
  name: string;
  size: number;
  mtime: number;
  type: '0' | '5';
}

function writeString(buffer: Buffer, value: string, offset: number, length: number): void {
  const bytes = Buffer.from(value, 'utf8');
  bytes.copy(buffer, offset, 0, Math.min(bytes.length, length));
}

function octal(value: number, length: number): string {
  return `${Math.max(0, Math.trunc(value)).toString(8).padStart(length - 1, '0')}\0`;
}

/** Nama panjang dipecah ke kolom prefix ustar (155 byte) dan name (100 byte). */
function splitName(name: string): { name: string; prefix: string } {
  if (Buffer.byteLength(name) <= 100) return { name, prefix: '' };
  for (let index = name.length - 1; index > 0; index -= 1) {
    if (name[index] !== '/') continue;
    const head = name.slice(0, index);
    const tail = name.slice(index + 1);
    if (Buffer.byteLength(tail) <= 100 && Buffer.byteLength(head) <= 155) {
      return { name: tail, prefix: head };
    }
  }
  return { name: name.slice(-100), prefix: '' };
}

function buildHeader(entry: TarEntry): Buffer {
  const header = Buffer.alloc(512, 0);
  const { name, prefix } = splitName(entry.name);

  writeString(header, name, 0, 100);
  writeString(header, octal(entry.type === '5' ? 0o755 : 0o644, 8), 100, 8);
  writeString(header, octal(0, 8), 108, 8);
  writeString(header, octal(0, 8), 116, 8);
  writeString(header, octal(entry.size, 12), 124, 12);
  writeString(header, octal(entry.mtime, 12), 136, 12);
  writeString(header, '        ', 148, 8);
  writeString(header, entry.type, 156, 1);
  writeString(header, 'ustar', 257, 6);
  writeString(header, '00', 263, 2);
  writeString(header, 'aznime', 265, 32);
  writeString(header, 'aznime', 297, 32);
  writeString(header, prefix, 345, 155);

  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeString(header, `${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8);

  return header;
}

async function collect(
  root: string,
  relative: string,
  entries: TarEntry[],
  budget: { bytes: number }
): Promise<void> {
  const absolute = path.join(root, relative);
  let info;
  try {
    info = await lstat(absolute);
  } catch {
    return;
  }

  /* Symlink dilewati: isinya sudah ada di tempat lain dan bisa menunjuk ke luar
     folder panel. */
  if (info.isSymbolicLink()) return;

  if (info.isDirectory()) {
    if (EXCLUDED_DIRS.has(path.basename(relative))) return;
    entries.push({ name: `${relative}/`, size: 0, mtime: Math.floor(info.mtimeMs / 1000), type: '5' });
    const children = await readdir(absolute).catch(() => [] as string[]);
    for (const child of children.sort()) {
      await collect(root, path.posix.join(relative, child), entries, budget);
    }
    return;
  }

  if (!info.isFile()) return;
  if (EXCLUDED_FILES.has(path.basename(relative))) return;
  if (info.size > 32 * 1024 * 1024) return;

  budget.bytes += info.size;
  if (budget.bytes > MAX_SOURCE_BYTES) {
    throw new BackupError('Isi panel terlalu besar untuk diarsipkan dalam satu berkas.');
  }

  entries.push({
    name: relative,
    size: info.size,
    mtime: Math.floor(info.mtimeMs / 1000),
    type: '0',
  });
}

async function buildTarGz(root: string, targets: string[]): Promise<Buffer> {
  const entries: TarEntry[] = [];
  const budget = { bytes: 0 };

  for (const target of targets) {
    if (existsSync(path.join(root, target))) await collect(root, target, entries, budget);
  }

  const chunks: Buffer[] = [];
  for (const entry of entries) {
    chunks.push(buildHeader(entry));
    if (entry.type !== '0') continue;
    const data = await readFile(path.join(root, entry.name));
    chunks.push(data);
    const padding = (512 - (data.length % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));

  return gzipSync(Buffer.concat(chunks), { level: 6 });
}

/** Folder panel adalah induk dari /production, tempat start-aznime.mjs berada. */
function resolvePanelRoot(): string | null {
  const candidates = [
    process.env.AZNIME_PANEL_ROOT?.trim(),
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    '/',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (
      existsSync(path.join(candidate, 'start-aznime.mjs')) &&
      existsSync(path.join(candidate, 'production', 'shared'))
    ) {
      return candidate;
    }
  }

  return null;
}

async function currentRelease(root: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(root, 'production', 'shared', 'release.json'), 'utf8');
    const parsed = JSON.parse(raw) as { current?: string };
    const current = (parsed.current || '').trim();
    return /^[0-9a-f]{7,40}$/i.test(current) ? current : null;
  } catch {
    return null;
  }
}

function assertDeliverable(data: Buffer, label: string): void {
  if (data.length === 0) throw new BackupError(`Arsip ${label} kosong.`);
  if (data.length > MAX_DELIVERY_BYTES) {
    throw new BackupError(
      `Arsip ${label} berukuran ${formatBytes(data.length)}, melebihi batas kirim Telegram ${formatBytes(
        MAX_DELIVERY_BYTES
      )}.`
    );
  }
}

export async function createRepoBackup(): Promise<BackupFile> {
  let response: Response;
  try {
    response = await fetch(REPO_ZIP_URL, {
      headers: { 'User-Agent': 'Aznime-Bot' },
      signal: AbortSignal.timeout(60000),
      cache: 'no-store',
    });
  } catch {
    throw new BackupError('GitHub tidak bisa dihubungi dari server.');
  }

  if (!response.ok) {
    throw new BackupError(`GitHub menolak permintaan arsip (HTTP ${response.status}).`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  assertDeliverable(data, 'repo');

  return { kind: 'repo', filename: `aznime-repo-main-${stamp()}.zip`, data };
}

export async function createPanelBackup(): Promise<BackupFile> {
  const root = resolvePanelRoot();
  if (!root) {
    throw new BackupError('Folder panel tidak ditemukan dari dalam container.');
  }

  const release = await currentRelease(root);
  const targets = ['start-aznime.mjs', 'production/pterodactyl.mjs', 'production/shared'];
  if (release) targets.push(`production/releases/${release}`);

  const data = await buildTarGz(root, targets);
  assertDeliverable(data, 'panel');

  const label = release ? release.slice(0, 8) : 'tanpa-rilis';
  return { kind: 'panel', filename: `aznime-panel-${label}-${stamp()}.tar.gz`, data };
}

/** Kirim arsip sebagai dokumen lewat Bot API (multipart, bukan JSON). */
export async function sendBackupDocument(
  chatId: number,
  file: BackupFile,
  caption: string
): Promise<void> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^bot(?=\d+:)/i, '');
  if (!token) throw new BackupError('TELEGRAM_BOT_TOKEN belum dikonfigurasi.');

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption.slice(0, 1000));
  form.append(
    'document',
    new Blob([new Uint8Array(file.data)], {
      type: file.kind === 'repo' ? 'application/zip' : 'application/gzip',
    }),
    file.filename
  );

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new BackupError(`Telegram menolak berkas (${response.status}): ${detail.slice(0, 160)}`);
  }
}
