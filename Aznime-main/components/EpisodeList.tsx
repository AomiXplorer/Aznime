'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Play, Search } from 'lucide-react';
import type { EpisodeSummary } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';

interface EpisodeListProps {
  episodes: EpisodeSummary[];
  /** Slug episode yang sedang diputar, dipakai untuk menandai baris aktif. */
  currentSlug?: string | null;
  /** Awalan rute pemutar; halaman /hentai memakai /hentai/watch. */
  hrefBase?: string;
}

export function EpisodeList({ episodes, currentSlug, hrefBase = '/watch' }: EpisodeListProps) {
  const [filterText, setFilterText] = useState('');
  const [reverseOrder, setReverseOrder] = useState(false);

  const visibleEpisodes = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const base = reverseOrder ? [...episodes].reverse() : episodes;
    if (!q) return base;
    return base.filter(
      (ep) =>
        (ep.number || '').toLowerCase().includes(q) ||
        ep.title.toLowerCase().includes(q)
    );
  }, [episodes, filterText, reverseOrder]);

  // Rentang nomor episode yang benar-benar tersedia di sumber.
  const { minEp, maxEp } = useMemo(() => {
    const numbers = episodes
      .map((ep) => Number((ep.number || '').trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (numbers.length === 0) return { minEp: null, maxEp: null };
    return { minEp: Math.min(...numbers), maxEp: Math.max(...numbers) };
  }, [episodes]);

  const hasRange = minEp !== null && maxEp !== null && minEp !== maxEp;
  const startsLate = minEp !== null && minEp > 1;

  if (episodes.length === 0) {
    return <p className="py-5 text-[12.5px] text-zinc-500">Belum ada episode untuk judul ini.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="episode-filter-input" className="sr-only">
            Cari nomor atau judul episode
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            id="episode-filter-input"
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Cari episode"
            className="h-9 w-full rounded-md bg-white/[0.04] pl-8 pr-2.5 text-[12.5px] text-zinc-100 placeholder:text-zinc-500 transition-colors duration-150 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-accent/60"
          />
        </div>

        <button
          type="button"
          onClick={() => setReverseOrder((prev) => !prev)}
          aria-pressed={reverseOrder}
          title={reverseOrder ? 'Urutan: terlama dahulu' : 'Urutan: terbaru dahulu'}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{reverseOrder ? 'Terlama' : 'Terbaru'}</span>
        </button>
      </div>

      {hasRange || startsLate ? (
        <p className="pb-2 text-[11.5px] leading-relaxed text-zinc-500">
          {hasRange ? `Tersedia episode ${minEp}–${maxEp} (${episodes.length} episode).` : null}
          {hasRange && startsLate ? ' ' : null}
          {startsLate
            ? `Sumber baru menyediakan episode ${minEp} ke atas, episode sebelumnya belum bisa diputar di sini.`
            : null}
        </p>
      ) : null}

      {visibleEpisodes.length === 0 ? (
        <p className="py-5 text-[12.5px] text-zinc-500">
          Tidak ada episode yang cocok dengan &ldquo;{filterText}&rdquo;.
        </p>
      ) : (
        <ul
          aria-label="Daftar episode"
          className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visibleEpisodes.map((ep, idx) => {
            const href = ep.slug ? `${hrefBase}/${encodeURIComponent(ep.slug)}` : '/anime';
            const isActive = Boolean(currentSlug && ep.slug === currentSlug);
            return (
              <li key={`${ep.slug || idx}`} className="ep-item border-b border-line-soft last:border-b-0">
                <Link
                  href={href}
                  prefetch={false}
                  aria-current={isActive ? 'page' : undefined}
                  title={ep.title}
                  className={cn(
                    'group flex min-h-11 items-center gap-2.5 pr-1 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:min-h-10 sm:text-[12.5px]',
                    isActive ? 'text-white' : 'text-zinc-300 hover:text-white'
                  )}
                >
                  <span
                    className={cn(
                      'w-8 shrink-0 font-mono text-[11.5px] font-semibold tabular-nums',
                      isActive ? 'text-accent-soft' : 'text-zinc-500 group-hover:text-zinc-400'
                    )}
                  >
                    {ep.number || '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{ep.title}</span>
                  {isActive ? (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-soft">
                      Diputar
                    </span>
                  ) : (
                    <Play
                      className="h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
