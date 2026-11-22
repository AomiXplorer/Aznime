'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Server } from 'lucide-react';
import type { MirrorServer } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';

export interface NekopoiNavLink {
  href: string;
  label: string;
}

interface NekopoiPlayerProps {
  title: string;
  servers: MirrorServer[];
  navigation: {
    prev: NekopoiNavLink | null;
    next: NekopoiNavLink | null;
  };
  seriesHref: string | null;
  seriesTitle: string | null;
}

/**
 * Pemutar Nekopoi. Sumbernya iframe pihak ketiga (playmogo/stmpoi), jadi
 * sandbox sengaja tidak dipasang: sandbox membuat banyak host menolak memutar
 * video. Server dipilih manual oleh penonton, tanpa deteksi otomatis, karena
 * semua server memakai host yang sama.
 */
export function NekopoiPlayer({ title, servers, navigation, seriesHref, seriesTitle }: NekopoiPlayerProps) {
  const playable = useMemo(
    () => servers.filter((server) => server.available && Boolean(server.url)),
    [servers]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const active = playable[selectedIdx] || playable[0] || null;

  const pick = (idx: number) => {
    if (idx === selectedIdx) return;
    setLoaded(false);
    setSelectedIdx(idx);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black">
      <div className="relative aspect-video w-full bg-black">
        {active?.url ? (
          <>
            <iframe
              key={active.url}
              src={active.url}
              title={title}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
            />
            {!loaded ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400 motion-reduce:animate-none" aria-hidden="true" />
                <p className="text-[12px] text-zinc-400">Memuat {active.name}…</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <Server className="h-6 w-6 text-zinc-600" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-zinc-300">Tidak ada server yang bisa diputar</p>
            <p className="max-w-sm text-[12px] leading-relaxed text-zinc-500">
              Sumber episode ini sedang tidak menyediakan tautan streaming. Tautan unduhan di bawah
              tetap bisa dipakai.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.08] bg-surface px-2.5 py-2">
        {navigation.prev ? (
          <Link
            href={navigation.prev.href}
            prefetch={false}
            title={navigation.prev.label}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
                'inline-flex h-8 cursor-pointer items-center rounded-md px-2.5 text-[11.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
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
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <p className="border-t border-white/[0.06] bg-surface px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
        Server video disediakan pihak ketiga dan biasanya menampilkan iklan. Kalau satu server gagal,
        pilih server lain
        {seriesHref && seriesTitle ? (
          <>
            , atau kembali ke{' '}
            <Link href={seriesHref} className="text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-white">
              {seriesTitle}
            </Link>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}
