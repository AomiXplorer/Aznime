'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Play, Search } from 'lucide-react';
import type { EpisodeSummary } from '@/lib/scraper/types';

interface EpisodeListProps {
  episodes: EpisodeSummary[];
}

export function EpisodeList({ episodes }: EpisodeListProps) {
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

  if (episodes.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-surface p-6 text-center text-sm text-zinc-400">
        Belum ada episode yang tersedia untuk judul ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <label htmlFor="episode-filter-input" className="sr-only">
            Filter nomor atau judul episode
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            id="episode-filter-input"
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Cari episode (misal: 12)..."
            className="h-9 w-full rounded-md border border-white/15 bg-surface pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent-ink focus:outline-none focus:ring-1 focus:ring-accent-ink"
          />
        </div>

        <button
          type="button"
          onClick={() => setReverseOrder((prev) => !prev)}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-surface px-3 text-xs font-medium text-zinc-200 transition-colors duration-150 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
        >
          <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
          {reverseOrder ? 'Urutkan: Terlama dahulu' : 'Urutkan: Terbaru dahulu'}
        </button>
      </div>

      {visibleEpisodes.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-surface p-6 text-center text-sm text-zinc-400">
          Tidak ada episode yang cocok dengan &ldquo;{filterText}&rdquo;.
        </p>
      ) : (
        <ul className="grid max-h-[520px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {visibleEpisodes.map((ep, idx) => {
            const href = ep.slug ? `/watch/${encodeURIComponent(ep.slug)}` : '/anime';
            return (
              <li key={`${ep.slug || idx}`}>
                <Link
                  href={href}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-surface p-3 transition-colors duration-150 hover:border-accent-ink/50 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {ep.number ? (
                        <span className="font-mono text-xs font-semibold tabular-nums text-accent-ink">
                          EP {ep.number}
                        </span>
                      ) : null}
                      {ep.date ? (
                        <span className="text-xs text-zinc-500">{ep.date}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium text-zinc-100 group-hover:text-white">
                      {ep.title}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-zinc-300 transition-colors duration-150 group-hover:bg-accent group-hover:text-white">
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
