'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { TurnstileWidget } from './TurnstileWidget';
import { clearGuestHistory, readGuestHistory } from '@/lib/guest-history';

export type AuthMode = 'login' | 'signup';

interface AuthConfig {
  turnstileSiteKey: string | null;
  providers: { google: boolean; discord: boolean };
  redis: boolean;
}

const BENEFITS = [
  'Simpan watch history secara otomatis',
  'Lanjutkan menonton dari episode terakhir',
  'Simpan anime ke daftar favorit',
  'Sinkronisasi riwayat antarperangkat',
];

interface AuthDialogProps {
  mode: AuthMode;
  returnTo?: string;
  onClose: () => void;
  onAuthenticated: () => Promise<void> | void;
}

export function AuthDialog({ mode: initialMode, returnTo, onClose, onAuthenticated }: AuthDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/config', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AuthConfig | null) => {
        if (!cancelled && data) setConfig(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const siteKey = config?.turnstileSiteKey || null;
  const providers = config?.providers || { google: false, discord: false };

  const oauthHref = (provider: 'google' | 'discord') => {
    const target = returnTo || (typeof window !== 'undefined' ? window.location.pathname : '/');
    return `/api/auth/oauth/${provider}?returnTo=${encodeURIComponent(target)}`;
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (siteKey && !token) {
      setError('Selesaikan verifikasi keamanan dulu.');
      return;
    }

    setBusy(true);
    try {
      const guestHistory = readGuestHistory();
      const payload: Record<string, unknown> = { email, password, turnstileToken: token };
      if (guestHistory.length > 0) payload.guestHistory = guestHistory;
      if (mode === 'signup') {
        payload.confirmPassword = confirmPassword;
        if (username.trim()) payload.username = username.trim();
      }

      const response = await fetch(`/api/auth/${mode === 'signup' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        synced?: boolean;
        code?: string;
      };

      if (!response.ok) {
        setError(data.error || 'Gagal memproses permintaan. Coba lagi.');
        setToken('');
        setResetSignal((value) => value + 1);
        return;
      }

      if (data.synced) clearGuestHistory();
      await onAuthenticated();
      onClose();
      if (returnTo && typeof window !== 'undefined' && window.location.pathname !== returnTo) {
        router.push(returnTo);
      }
    } catch {
      setError('Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.');
      setToken('');
      setResetSignal((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  const heading = returnTo
    ? 'Lanjutkan pengalaman menontonmu'
    : mode === 'login'
      ? 'Masuk ke Aznime'
      : 'Buat akun Aznime';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="relative max-h-[92vh] w-full max-w-[440px] overflow-y-auto border border-line bg-elevated px-5 pb-6 pt-5 sm:rounded-[6px]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[4px] text-zinc-400 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <h2 id="auth-dialog-title" className="pr-8 text-[19px] leading-snug text-white">
          {heading}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
          {returnTo
            ? 'Buat akun gratis untuk melanjutkan menonton anime dan menyimpan riwayat serta daftar favoritmu.'
            : mode === 'login'
              ? 'Masuk untuk melanjutkan riwayat menonton dan daftar favoritmu.'
              : 'Cukup email dan password. Episode 1-3 tetap bisa ditonton tanpa akun.'}
        </p>

        {returnTo ? (
          <ul className="mt-4 grid gap-2 border-y border-line py-3.5">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-[4px] border border-line p-1">
          {(['login', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                setError(null);
              }}
              aria-pressed={mode === tab}
              className={`h-8 cursor-pointer rounded-[3px] text-[12.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                mode === tab ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 grid gap-3" noValidate>
          <label className="grid gap-1.5">
            <span className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-500">Email</span>
            <input
              ref={firstFieldRef}
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 rounded-[4px] border border-line bg-surface px-3 text-[13.5px] text-white outline-none transition-colors duration-150 placeholder:text-zinc-600 focus:border-zinc-600"
              placeholder="nama@email.com"
            />
          </label>

          {mode === 'signup' ? (
            <label className="grid gap-1.5">
              <span className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-500">
                Username <span className="normal-case tracking-normal text-zinc-600">(opsional)</span>
              </span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-10 rounded-[4px] border border-line bg-surface px-3 text-[13.5px] text-white outline-none transition-colors duration-150 placeholder:text-zinc-600 focus:border-zinc-600"
                placeholder="aznime_fan"
              />
            </label>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-500">Password</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 rounded-[4px] border border-line bg-surface px-3 text-[13.5px] text-white outline-none transition-colors duration-150 placeholder:text-zinc-600 focus:border-zinc-600"
              placeholder="Minimal 8 karakter"
            />
          </label>

          {mode === 'signup' ? (
            <label className="grid gap-1.5">
              <span className="text-[11.5px] font-medium uppercase tracking-wide text-zinc-500">
                Ulangi password
              </span>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-10 rounded-[4px] border border-line bg-surface px-3 text-[13.5px] text-white outline-none transition-colors duration-150 placeholder:text-zinc-600 focus:border-zinc-600"
                placeholder="Ulangi password"
              />
            </label>
          ) : null}

          {siteKey ? (
            <TurnstileWidget
              siteKey={siteKey}
              resetSignal={resetSignal}
              onToken={setToken}
              onExpire={() => setToken('')}
              onError={() => {
                setToken('');
                setError('Verifikasi keamanan gagal dimuat. Muat ulang halaman lalu coba lagi.');
              }}
            />
          ) : null}

          {error ? (
            <p role="alert" className="border-l-2 border-accent bg-accent/10 px-3 py-2 text-[12.5px] leading-relaxed text-[#ffd7de]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[4px] bg-accent-strong px-4 text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {mode === 'login' ? 'Masuk' : 'Daftar gratis'}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wide text-zinc-600">atau</span>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>

        <div className="mt-3 grid gap-2">
          <a
            href={providers.google ? oauthHref('google') : undefined}
            aria-disabled={!providers.google}
            onClick={(event) => {
              if (!providers.google) event.preventDefault();
            }}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-line text-[13px] font-medium transition-colors duration-150 ${
              providers.google
                ? 'text-zinc-200 hover:border-zinc-600 hover:text-white'
                : 'cursor-not-allowed text-zinc-600'
            }`}
          >
            <GoogleIcon />
            Lanjut dengan Google
          </a>
          <a
            href={providers.discord ? oauthHref('discord') : undefined}
            aria-disabled={!providers.discord}
            onClick={(event) => {
              if (!providers.discord) event.preventDefault();
            }}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-line text-[13px] font-medium transition-colors duration-150 ${
              providers.discord
                ? 'text-zinc-200 hover:border-zinc-600 hover:text-white'
                : 'cursor-not-allowed text-zinc-600'
            }`}
          >
            <DiscordIcon />
            Lanjut dengan Discord
          </a>
          {!providers.google || !providers.discord ? (
            <p className="text-[11.5px] leading-relaxed text-zinc-600">
              Login sosial menyala setelah kredensial OAuth diisi di environment.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M12 11v2.4h5.6c-.24 1.4-1.7 4.2-5.6 4.2A6.6 6.6 0 0 1 12 5.4a6 6 0 0 1 4.2 1.6l2-1.9A8.9 8.9 0 0 0 12 2.6 9.4 9.4 0 1 0 21.4 12c0-.6-.06-1-.14-1.4H12Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M19.3 5.4A16 16 0 0 0 15.4 4l-.3.6a12 12 0 0 0-6.2 0L8.6 4a16 16 0 0 0-3.9 1.4C2.3 9.2 1.6 12.9 2 16.5a15 15 0 0 0 4.7 2.4l.6-1a10 10 0 0 1-1.6-.8l.4-.3a11 11 0 0 0 9.8 0l.4.3a10 10 0 0 1-1.6.8l.6 1a15 15 0 0 0 4.7-2.4c.5-4.2-.6-7.9-2.7-11.1ZM9 14.2c-.9 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6 0c-.9 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z" />
    </svg>
  );
}
