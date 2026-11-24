'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CONTRIBUTORS } from '@/lib/credits';
import { DEFAULT_MAINTENANCE_MESSAGE } from '@/lib/maintenance-constants';
import { SITE_URL } from '@/lib/site';
import { ContributorProfile } from './ContributorProfile';
import { Wordmark } from './Wordmark';

export interface MaintenancePublicState {
  enabled: boolean;
  message: string;
  startedAt: string | null;
  endsAt: string | null;
}

interface MaintenanceViewProps {
  initialState: MaintenancePublicState;
  bypassInvalid?: boolean;
}

const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

function formatCountdown(endsAt: string | null, nowMs: number): string | null {
  if (!endsAt) return null;
  const targetMs = Date.parse(endsAt);
  if (!Number.isFinite(targetMs)) return null;

  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  if (diffSec <= 0) return 'Sebentar lagi selesai';

  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatWibTarget(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) return null;
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date) + ' WIB'
  );
}

export function MaintenanceView({ initialState, bypassInvalid = false }: MaintenanceViewProps) {
  const [state, setState] = useState<MaintenancePublicState>(initialState);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    if (!state.enabled || !state.endsAt) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.enabled, state.endsAt]);

  async function handleRecheck() {
    if (checking) return;
    setChecking(true);
    setCheckNote(null);

    try {
      const res = await fetch('/api/maintenance/status', { cache: 'no-store' });
      if (!res.ok) {
        setCheckNote('Server masih sibuk, coba muat ulang sebentar lagi.');
        return;
      }

      const data = (await res.json()) as MaintenancePublicState & { bypassActive?: boolean };
      setState({
        enabled: data.enabled,
        message: data.message,
        startedAt: data.startedAt,
        endsAt: data.endsAt,
      });

      if (!data.enabled || data.bypassActive) {
        window.location.assign('/');
        return;
      }

      const checkedAt = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date());
      setCheckNote(`Perbaikan masih berlangsung (dicek ${checkedAt} WIB).`);
    } catch {
      setCheckNote('Gagal memeriksa status. Periksa koneksi internet kamu.');
    } finally {
      setChecking(false);
    }
  }

  const countdown = state.enabled && nowMs !== null ? formatCountdown(state.endsAt, nowMs) : null;
  const targetWib = state.enabled ? formatWibTarget(state.endsAt) : null;
  const customMessage =
    state.enabled && state.message && state.message !== DEFAULT_MAINTENANCE_MESSAGE
      ? state.message
      : null;

  return (
    <div
      data-maintenance-screen=""
      className="relative isolate flex min-h-screen flex-col overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(75%_50%_at_20%_-10%,rgba(225,29,72,0.14),transparent_72%)]"
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-7 sm:px-8">
        <Link
          href="/"
          aria-label="Aznime, ke beranda"
          className="rounded-sm text-[1.45rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Wordmark />
        </Link>
        <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-400">
          <span aria-hidden="true" className="relative flex h-1.5 w-1.5 items-center justify-center">
            {state.enabled ? (
              <span className="absolute h-4 w-4 rounded-full bg-accent/25 motion-safe:animate-ping" />
            ) : null}
            <span
              className={cn(
                'relative h-1.5 w-1.5 rounded-full',
                state.enabled ? 'bg-accent' : 'bg-[#fda4af]'
              )}
            />
          </span>
          {state.enabled ? 'Pemeliharaan' : 'Operasional'}
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-16 lg:py-16">
        <section aria-labelledby="maintenance-heading" className="reveal">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500">
            Status layanan
          </p>

          <h1
            id="maintenance-heading"
            className="mt-5 max-w-[15ch] text-balance font-display text-[clamp(2.3rem,7.6vw,4rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-white"
          >
            {state.enabled ? 'Sedang Dalam Pemeliharaan' : 'Aznime sudah kembali online'}
          </h1>

          <p className="mt-6 max-w-[52ch] text-[14.5px] leading-relaxed text-zinc-300">
            {state.enabled
              ? 'Kami sedang melakukan beberapa penyesuaian untuk memberikan pengalaman menonton yang lebih baik. Silakan kembali beberapa saat lagi.'
              : 'Pemeliharaan sudah selesai dan seluruh katalog bisa diakses kembali seperti biasa.'}
          </p>

          {customMessage ? (
            <p className="mt-5 max-w-[52ch] text-[13px] leading-relaxed text-zinc-400">
              <span className="mr-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                Catatan
              </span>
              {customMessage}
            </p>
          ) : null}

          {bypassInvalid ? (
            <p
              role="status"
              className="mt-6 max-w-[52ch] rounded-lg border border-[#6d2637] bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-[#fecdd3]"
            >
              Tautan bypass admin tidak valid atau sudah kedaluwarsa. Minta tautan baru lewat bot
              Telegram.
            </p>
          ) : null}

          {state.enabled ? (
            <dl className="mt-9 grid max-w-md grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Estimasi selesai
                </dt>
                <dd className="mt-1.5 font-display text-[15px] font-semibold tabular-nums tracking-[-0.01em] text-zinc-100">
                  {targetWib ?? 'Sedang ditangani'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Sisa waktu
                </dt>
                <dd className="mt-1.5 font-display text-[15px] font-semibold tabular-nums tracking-[-0.01em] text-[#fda4af]">
                  {countdown ?? 'Tanpa batas'}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {state.enabled ? (
              <button
                type="button"
                onClick={handleRecheck}
                disabled={checking}
                className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-md bg-accent-strong px-5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <RefreshCw className={cn('h-4 w-4', checking && 'motion-safe:animate-spin')} aria-hidden="true" />
                {checking ? 'Memeriksa...' : 'Cek Lagi Sekarang'}
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex h-12 items-center gap-2.5 rounded-md bg-accent-strong px-5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Buka Beranda Aznime
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>

          {checkNote ? (
            <p role="status" className="mt-4 text-[12px] tabular-nums text-zinc-400">
              {checkNote}
            </p>
          ) : null}
        </section>

        <aside aria-labelledby="maintenance-contributors" className="lg:border-l lg:border-line lg:pl-12">
          <h2
            id="maintenance-contributors"
            className="text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500"
          >
            Contributors
          </h2>
          <ul className="mt-4">
            {CONTRIBUTORS.map((contributor) => (
              <ContributorProfile key={contributor.id} contributor={contributor} variant="inline" />
            ))}
          </ul>
          <p className="mt-5 max-w-[38ch] text-[12px] leading-relaxed text-zinc-500">
            Kabar pemulihan layanan dikirim lewat kanal WhatsApp yang tersedia di atas.
          </p>
        </aside>
      </div>

      <footer className="mx-auto w-full max-w-6xl border-t border-line px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-2 text-[11.5px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Aznime. Seluruh hak cipta dilindungi.</p>
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="h-px w-6 bg-line" />
            {SITE_HOST}
          </p>
        </div>
      </footer>
    </div>
  );
}
