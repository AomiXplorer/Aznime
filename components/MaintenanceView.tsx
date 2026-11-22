'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, MessageCircle, RefreshCw, Wrench } from 'lucide-react';
import { CREDITS } from '@/lib/credits';

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

function formatCountdown(endsAt: string | null, nowMs: number): string | null {
  if (!endsAt) return null;
  const targetMs = Date.parse(endsAt);
  if (!Number.isFinite(targetMs)) return null;

  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  if (diffSec <= 0) return 'Sedang tahap finalisasi — segera kembali';

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

  return (
    <div
      data-maintenance-screen=""
      className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12 sm:px-6"
    >
      <div className="mb-8">
        <Link
          href="/"
          className="inline-block text-[1.6rem] font-extrabold tracking-tight text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Aznime
        </Link>
      </div>

      <section className="rounded-xl border border-white/[0.08] bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-zinc-400">
          <Wrench className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{state.enabled ? 'Pemeliharaan Sistem (503)' : 'Status Layanan Normal'}</span>
        </div>

        <h1 className="mt-3 text-balance font-display text-[1.75rem] font-extrabold leading-tight text-white sm:text-[2.15rem]">
          {state.enabled
            ? 'Aznime sedang dalam perbaikan sementara.'
            : 'Aznime sudah kembali online.'}
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
          {state.enabled
            ? state.message
            : 'Pemeliharaan telah selesai dan seluruh katalog sudah bisa diakses kembali.'}
        </p>

        {bypassInvalid ? (
          <p
            role="status"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3.5 py-2.5 text-[13px] text-rose-200"
          >
            Tautan bypass admin tidak valid atau sudah kedaluwarsa. Minta tautan baru melalui bot
            Telegram.
          </p>
        ) : null}

        {state.enabled ? (
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.07] pt-5 text-[13px] text-zinc-400">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              <span>Estimasi selesai:</span>
              <span className="font-semibold tabular-nums text-zinc-100">
                {targetWib || 'Sedang ditangani'}
              </span>
            </div>
            {countdown ? (
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-zinc-600">
                  ·
                </span>
                <span>Sisa waktu:</span>
                <span className="font-semibold tabular-nums text-rose-300">{countdown}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {state.enabled ? (
            <button
              type="button"
              onClick={handleRecheck}
              disabled={checking}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-accent-strong px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <RefreshCw
                className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {checking ? 'Memeriksa...' : 'Cek Lagi Sekarang'}
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-strong px-4 text-[13.5px] font-bold text-white transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Buka Beranda Aznime
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        {checkNote ? (
          <p role="status" className="mt-3 text-[12.5px] tabular-nums text-zinc-400">
            {checkNote}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="kanal-info-heading" className="mt-6">
        <div className="mb-3">
          <h2 id="kanal-info-heading" className="text-[14px] font-bold text-zinc-200">
            Kanal info resmi
          </h2>
          <p className="mt-0.5 text-[12.5px] text-zinc-400">
            Pantau kabar pemulihan layanan langsung dari saluran WhatsApp pengelola Aznime:
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {CREDITS.map((credit) => (
            <li key={credit.name}>
              <a
                href={credit.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${credit.channelLabel} (dibuka di tab baru)`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-surface px-4 py-3.5 transition-colors duration-150 hover:border-white/20 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-white">{credit.name}</p>
                  <p className="truncate text-[12px] text-rose-300 transition-colors group-hover:text-rose-200">
                    {credit.channelLabel}
                  </p>
                </div>
                <MessageCircle
                  className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-rose-300"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
