'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Play, Server } from 'lucide-react';
import type { DonghiveServer } from '@/lib/donghive';
import { AnimeImage } from './AnimeImage';

interface DonghivePlayerProps {
  title: string;
  poster: string | null;
  servers: DonghiveServer[];
  navigation: { prev: { href: string; label: string } | null; next: { href: string; label: string } | null };
}

export function DonghivePlayer({ title, poster, servers, navigation }: DonghivePlayerProps) {
  const [selected, setSelected] = useState(0);
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const active = servers[selected] || servers[0] || null;

  const selectServer = (index: number) => {
    setSelected(index);
    setLoaded(false);
  };

  return (
    <section aria-label="Pemutar episode" className="overflow-hidden border-y border-[#2b2222] bg-black sm:rounded-[8px] sm:border">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {!active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <Server className="h-6 w-6 text-zinc-600" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-zinc-300">Server belum tersedia</p>
            <p className="text-[12px] text-zinc-500">Coba episode lain nanti.</p>
          </div>
        ) : started ? (
          <>
            <iframe
              key={`${active.url}-${selected}`}
              src={active.url}
              title={title}
              className="absolute inset-0 h-full w-full border-0"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
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
            <AnimeImage src={poster} alt={title} sizes="(max-width: 1024px) 100vw, 780px" unoptimized />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-md bg-white px-6 text-[14px] font-bold text-black transition-colors duration-150 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Tonton {active.name}
              </button>
              <p className="text-[11.5px] text-zinc-400">Pemutar dari server pihak ketiga.</p>
            </div>
          </>
        )}
      </div>

      <div className="flex min-h-12 flex-wrap items-center gap-1.5 border-t border-[#2b2222] bg-surface px-2.5 py-2">
        {navigation.prev ? (
          <Link
            href={navigation.prev.href}
            prefetch={false}
            title={navigation.prev.label}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Link>
        ) : null}

        <div role="group" aria-label="Pilih server" className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1">
          {servers.map((server, index) => (
            <button
              key={`${server.url}-${index}`}
              type="button"
              onClick={() => selectServer(index)}
              aria-pressed={selected === index}
              className={`inline-flex h-8 cursor-pointer items-center rounded-md px-2.5 text-[11.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                selected === index ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {server.name}
            </button>
          ))}
        </div>

        {active ? (
          <a
            href={active.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title="Buka server di tab baru"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
