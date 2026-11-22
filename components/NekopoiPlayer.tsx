'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Play, Server, ShieldCheck, ShieldOff } from 'lucide-react';
import type { MirrorServer } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';
import { AnimeImage } from './AnimeImage';

export interface NekopoiNavLink {
  href: string;
  label: string;
}

interface NekopoiPlayerProps {
  title: string;
  /** Thumbnail episode, dipakai sebagai latar tombol tonton. */
  poster?: string | null;
  servers: MirrorServer[];
  navigation: {
    prev: NekopoiNavLink | null;
    next: NekopoiNavLink | null;
  };
  seriesHref: string | null;
  seriesTitle: string | null;
}

/**
 * Pemutar Nekopoi memakai iframe pihak ketiga (playmogo/stmpoi). Dua lapis
 * pengaman dipakai supaya iklan sumber tidak menyeret penonton keluar:
 *
 * 1. Iframe baru dipasang setelah tombol tonton ditekan, jadi skrip iklan tidak
 *    jalan saat halaman dibuka.
 * 2. Sandbox tanpa allow-popups dan allow-top-navigation memblokir pop-up
 *    sekaligus pengalihan seluruh halaman (iklan "teleport" ke toko online).
 *
 * Kalau sebuah host menolak diputar di dalam sandbox, penonton bisa memilih
 * mode kompatibel. Pilihannya per episode dan disertai peringatan.
 */
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';

export function NekopoiPlayer({
  title,
  poster,
  servers,
  navigation,
  seriesHref,
  seriesTitle,
}: NekopoiPlayerProps) {
  const playable = useMemo(
    () => servers.filter((server) => server.available && Boolean(server.url)),
    [servers]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sandboxed, setSandboxed] = useState(true);

  const active = playable[selectedIdx] || playable[0] || null;

  const pick = (idx: number) => {
    if (idx === selectedIdx) return;
    setLoaded(false);
    setSelectedIdx(idx);
  };

  const start = () => {
    setLoaded(false);
    setStarted(true);
  };

  return (
    <div className="overflow-hidden rounded-[8px] border border-white/[0.08] bg-black">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {!active?.url ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <Server className="h-6 w-6 text-zinc-600" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-zinc-300">Belum ada server untuk episode ini</p>
            <p className="max-w-xs text-[12px] leading-relaxed text-zinc-500">
              Coba tautan unduhan di bawah, atau buka episode lain.
            </p>
          </div>
        ) : started ? (
          <>
            <iframe
              key={`${active.url}-${sandboxed ? 'safe' : 'compat'}`}
              src={active.url}
              title={title}
              sandbox={sandboxed ? SANDBOX : undefined}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
            />
            {!loaded ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400 motion-reduce:animate-none" aria-hidden="true" />
                <p className="text-[12px] text-zinc-400">Memuat {active.name}…</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <AnimeImage
              src={poster}
              alt={title}
              sizes="(max-width: 1024px) 100vw, 780px"
              /* Poster sudah dilayani proksi /api/img, jadi tidak perlu melewati
                 optimizer gambar Next sekali lagi. */
              unoptimized
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <button
                type="button"
                onClick={start}
                className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[6px] bg-white px-6 text-[14px] font-bold text-black transition-transform duration-150 hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Tonton {active.name}
              </button>
              <p className="text-[11.5px] text-zinc-400">
                Pemutar pihak ketiga. Mode aman aktif: pop-up dan pengalihan halaman diblokir.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] bg-surface px-2.5 py-2">
        {navigation.prev ? (
          <Link
            href={navigation.prev.href}
            prefetch={false}
            title={navigation.prev.label}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[4px] px-2 text-[12px] font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Link>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1">
          {playable.map((server, idx) => (
            <button
              key={`${server.name}-${idx}`}
              type="button"
              onClick={() => pick(idx)}
              aria-pressed={idx === selectedIdx}
              className={cn(
                'inline-flex h-8 cursor-pointer items-center rounded-[4px] px-2.5 text-[11.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                idx === selectedIdx
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
              )}
            >
              {server.name}
            </button>
          ))}
        </div>

        {active?.url ? (
          <a
            href={active.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title="Buka server di tab baru"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[4px] px-2 text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Tab baru</span>
          </a>
        ) : null}

        {navigation.next ? (
          <Link
            href={navigation.next.href}
            prefetch={false}
            title={navigation.next.label}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[4px] px-2 text-[12px] font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {active?.url ? (
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-surface px-3 py-2">
          <p className="text-[11px] leading-snug text-zinc-500">
            {sandboxed
              ? 'Mode aman aktif: iklan sumber tidak bisa membuka tab atau memindahkan halaman.'
              : 'Mode kompatibel: iklan sumber bisa membuka tab baru. Nyalakan mode aman bila tidak diperlukan.'}
            {seriesHref && seriesTitle ? (
              <>
                {' '}
                <Link
                  href={seriesHref}
                  className="text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-white"
                >
                  {seriesTitle}
                </Link>
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => {
              setSandboxed((prev) => !prev);
              setLoaded(false);
            }}
            aria-pressed={sandboxed}
            className={cn(
              'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[4px] px-2.5 text-[11.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              sandboxed
                ? 'bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/12 text-amber-300 hover:bg-amber-500/20'
            )}
          >
            {sandboxed ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {sandboxed ? 'Mode aman' : 'Mode kompatibel'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
