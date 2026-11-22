'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { TurnstileWidget } from './TurnstileWidget';
import { clearGuestHistory, readGuestHistory } from '@/lib/guest-history';

export type AuthMode = 'login' | 'signup';

interface AuthConfig {
  turnstileSiteKey: string | null;
  providers: { google: boolean; discord: boolean };
  redis: boolean;
}

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  email_exists: 'Email ini sudah terdaftar dengan password. Masuk pakai email dan password.',
  access_denied: 'Login dibatalkan.',
  provider_unavailable: 'Login dengan provider itu belum aktif.',
  invalid_state: 'Sesi login kedaluwarsa. Coba lagi.',
  missing_code: 'Login gagal. Coba lagi.',
  profile_unavailable: 'Profil dari provider tidak bisa dibaca. Coba lagi.',
  server_error: 'Terjadi kesalahan di server. Coba lagi.',
};

const INPUT_CLASS =
  'h-11 w-full rounded-[6px] border border-line bg-canvas px-3 text-[14px] text-white outline-none transition-colors duration-150 placeholder:text-zinc-600 hover:border-zinc-700 focus:border-zinc-500 focus-visible:outline-none disabled:opacity-60';

const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-[0.09em] text-zinc-500';

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={LABEL_CLASS}>
      {children}
    </label>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  type: 'email' | 'text';
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  hint?: string;
}

function TextField({ id, label, type, value, onChange, placeholder, autoComplete, inputRef, hint }: TextFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint ? <span className="text-[11px] text-zinc-600">{hint}</span> : null}
      </div>
      <input
        id={id}
        ref={inputRef}
        type={type}
        name={id}
        required={type === 'email'}
        autoComplete={autoComplete}
        inputMode={type === 'email' ? 'email' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          name={id}
          required
          minLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${INPUT_CLASS} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
          aria-pressed={visible}
          className="absolute right-1 top-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[4px] text-zinc-500 transition-colors duration-150 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

interface AuthDialogProps {
  mode: AuthMode;
  returnTo?: string;
  initialError?: string | null;
  onClose: () => void;
  onAuthenticated: () => Promise<void> | void;
}

export function AuthDialog({ mode: initialMode, returnTo, initialError, onClose, onAuthenticated }: AuthDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(initialError || null);
  const [busy, setBusy] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<'google' | 'discord' | null>(null);
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

  function startOAuth(provider: 'google' | 'discord') {
    if (!providers[provider] || oauthProvider) return;
    setOauthProvider(provider);
    const target = returnTo || (typeof window !== 'undefined' ? window.location.pathname : '/');
    window.location.href = `/api/auth/oauth/${provider}?returnTo=${encodeURIComponent(target)}`;
  }

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
      const data = (await response.json().catch(() => ({}))) as { error?: string; synced?: boolean; code?: string };

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

  const heading = returnTo ? 'Lanjutkan menonton' : mode === 'login' ? 'Masuk' : 'Buat akun';
  const description =
    mode === 'signup'
      ? 'Simpan riwayat tontonan dan anime favoritmu. Gratis, cukup email.'
      : 'Masuk untuk menyimpan riwayat tontonan dan anime favoritmu.';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70"
        aria-hidden="true"
        onClick={() => {
          if (!busy && !oauthProvider) onClose();
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[12px] border border-line bg-elevated shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8)] sm:max-h-[88dvh] sm:max-w-[400px] sm:rounded-[10px]"
      >
        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            <h2
              id="auth-dialog-title"
              className="font-display text-[19px] font-semibold leading-tight tracking-[-0.01em] text-white"
            >
              {heading}
            </h2>
            <p className="mt-1 text-[12.5px] leading-snug text-zinc-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-mr-1 -mt-0.5 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-zinc-500 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 pb-5 sm:px-5">
          <div role="tablist" aria-label="Pilih mode akun" className="grid grid-cols-2 gap-1 rounded-[6px] border border-line bg-surface p-1">
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => {
                  setMode(tab);
                  setError(null);
                }}
                className={`h-8 cursor-pointer rounded-[4px] text-[12.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  mode === tab ? 'bg-white/[0.09] text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {tab === 'login' ? 'Masuk' : 'Daftar'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-4 grid gap-3" noValidate>
            {mode === 'signup' ? (
              <TextField
                id="username"
                label="Username"
                type="text"
                value={username}
                onChange={setUsername}
                placeholder="Opsional"
                autoComplete="username"
                hint="opsional"
              />
            ) : null}

            <TextField
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="nama@email.com"
              autoComplete="email"
              inputRef={firstFieldRef}
            />

            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder={mode === 'signup' ? 'Minimal 8 karakter' : 'Password kamu'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />

            {mode === 'signup' ? (
              <PasswordField
                id="confirmPassword"
                label="Ulangi password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Ketik ulang password"
                autoComplete="new-password"
              />
            ) : null}

            {siteKey ? (
              <div className="w-full overflow-hidden rounded-[6px]">
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
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-[6px] border border-accent/40 bg-accent/10 px-3 py-2 text-[12px] leading-snug text-[#ffd9de]"
              >
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || Boolean(oauthProvider)}
              className="mt-0.5 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-accent-strong text-[13.5px] font-semibold text-white transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {mode === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          </form>

          <div className="my-3.5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-600">atau</span>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => startOAuth('google')}
              disabled={!providers.google || Boolean(oauthProvider) || busy}
              aria-label="Lanjut dengan Google"
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-line bg-surface text-[12.5px] font-medium text-zinc-200 transition-colors duration-150 hover:border-zinc-600 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {oauthProvider === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <GoogleMark />
              )}
              Google
            </button>
            <button
              type="button"
              onClick={() => startOAuth('discord')}
              disabled={!providers.discord || Boolean(oauthProvider) || busy}
              aria-label="Lanjut dengan Discord"
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-line bg-surface text-[12.5px] font-medium text-zinc-200 transition-colors duration-150 hover:border-zinc-600 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {oauthProvider === 'discord' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <DiscordMark />
              )}
              Discord
            </button>
          </div>

          {!providers.google || !providers.discord ? (
            <p className="mt-2.5 text-[11px] leading-snug text-zinc-600">
              Sebagian login sosial belum aktif di server.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Logo Google resmi (empat warna) dalam SVG inline. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

/** Logo Discord resmi (blurple) dalam SVG inline. */
function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
      <path
        fill="#5865F2"
        d="M20.32 4.94A19.6 19.6 0 0 0 15.45 3.4a.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.26a18.1 18.1 0 0 0-5.44 0c-.17-.4-.41-.88-.62-1.26a.07.07 0 0 0-.08-.04A19.5 19.5 0 0 0 3.7 4.94a.07.07 0 0 0-.03.03C.53 9.6-.32 14.13.1 18.6a.08.08 0 0 0 .03.06 19.8 19.8 0 0 0 5.96 3.01.07.07 0 0 0 .08-.03c.46-.63.87-1.29 1.22-1.99a.07.07 0 0 0-.04-.1 13 13 0 0 1-1.87-.9.07.07 0 0 1 0-.11c.13-.1.25-.2.37-.3a.07.07 0 0 1 .07-.01c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08.01c.12.1.24.2.37.3a.07.07 0 0 1 0 .11c-.6.35-1.22.65-1.87.9a.07.07 0 0 0-.04.1c.36.7.77 1.36 1.22 1.99a.07.07 0 0 0 .08.03 19.7 19.7 0 0 0 5.97-3.01.08.08 0 0 0 .03-.06c.5-5.17-.84-9.66-3.55-13.63a.06.06 0 0 0-.03-.03ZM8.02 15.88c-1.18 0-2.15-1.08-2.15-2.41s.95-2.42 2.15-2.42c1.21 0 2.17 1.09 2.15 2.42 0 1.33-.95 2.41-2.15 2.41Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.41s.95-2.42 2.15-2.42c1.21 0 2.17 1.09 2.15 2.42 0 1.33-.94 2.41-2.15 2.41Z"
      />
    </svg>
  );
}
