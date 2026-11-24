'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { List, Loader2 } from 'lucide-react';
import type { EpisodeNavLink, EpisodeSummary } from '@/lib/scraper/types';
import { episodeNumberFromTitle, matchesEpisodeQuery } from '@/lib/episode-format';
import { cn } from '@/lib/cn';

interface EpisodePickerProps {
  episodes: EpisodeNavLink[];
  currentPath: string;
  allEpisodesHref: string;
  seriesTitle?: string | null;
  totalEpisodes?: number;
  onOpenChange?: (open: boolean) => void;
  malzSearch?: {
    animeId: string;
    perPage: number;
  };
}

interface EpisodeResponse {
  items?: EpisodeSummary[];
  error?: string;
}

export function EpisodePicker({
  episodes,
  currentPath,
  allEpisodesHref,
  seriesTitle,
  totalEpisodes,
  onOpenChange,
  malzSearch,
}: EpisodePickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EpisodeNavLink[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const episodeTotal = totalEpisodes || episodes.length;

  useEffect(
    () => () => {
      requestId.current += 1;
      controllerRef.current?.abort();
    },
    []
  );

  const searchEpisodes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    controllerRef.current?.abort();
    const currentRequest = ++requestId.current;
    const normalized = query.trim();
    const number = normalized.match(/^(?:episode\s*)?(\d+(?:\.\d+)?)$/i)?.[1];
    if (!number) {
      setSearching(false);
      setError('Masukkan nomor episode, misalnya 500.');
      setResults([]);
      return;
    }

    const localMatches = episodes.filter((episode) =>
      matchesEpisodeQuery(
        {
          title: episode.title,
          number: episode.number || null,
          slug: episode.slug,
          url: episode.url,
          date: null,
        },
        number
      )
    );
    if (localMatches.length > 0) {
      setSearching(false);
      setResults(localMatches);
      setError(null);
      return;
    }
    if (!malzSearch || malzSearch.perPage <= 0) {
      setSearching(false);
      setResults([]);
      setError(`Episode ${number} tidak ada di daftar yang dimuat.`);
      return;
    }
    if (totalEpisodes && Number(number) > totalEpisodes) {
      setSearching(false);
      setResults([]);
      setError(`Nomor episode melebihi jumlah seri (${totalEpisodes}).`);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setSearching(true);
    setResults(null);
    setError(null);

    try {
      const target = Number(number);
      const estimatedPage = totalEpisodes
        ? Math.max(0, Math.floor((totalEpisodes - target) / malzSearch.perPage))
        : 0;
      const pages = [...new Set([estimatedPage - 1, estimatedPage, estimatedPage + 1])]
        .filter((page) => page >= 0);
      const responses = await Promise.all(
        pages.map(async (page) => {
          const response = await fetch(
            `/api/malz/episodes?id=${encodeURIComponent(malzSearch.animeId)}&page=${page}`,
            { signal: controller.signal }
          );
          const data = (await response.json()) as EpisodeResponse;
          if (!response.ok) throw new Error(data.error || 'Gagal mencari episode.');
          return data.items || [];
        })
      );
      if (currentRequest !== requestId.current) return;

      const matches = responses
        .flat()
        .filter((episode) => matchesEpisodeQuery(episode, number))
        .sort((a, b) => Number(b.number || 0) - Number(a.number || 0))
        .map((episode) => ({
          title: episode.title,
          slug: episode.slug,
          url: episode.url,
          number: episode.number,
        }));
      setResults(matches);
      if (matches.length === 0) setError(`Episode ${number} tidak ditemukan di arsip yang tersedia.`);
    } catch (err) {
      if (controller.signal.aborted || currentRequest !== requestId.current) return;
      setResults([]);
      setError(err instanceof Error ? err.message : 'Gagal mencari episode.');
    } finally {
      if (currentRequest === requestId.current) setSearching(false);
    }
  };

  const renderEpisode = (episode: EpisodeNavLink, index: number) => {
    const number = episode.number || episodeNumberFromTitle(episode.title);
    const isCurrent = Boolean(
      episode.slug &&
        (currentPath.endsWith(`/${encodeURIComponent(episode.slug)}`) ||
          currentPath.endsWith(`/${episode.slug}`))
    );
    return (
      <li key={episode.slug || `${episode.title}-${index}`}>
        {episode.slug ? (
          <Link
            href={`/watch/${encodeURIComponent(episode.slug)}`}
            prefetch={false}
            aria-current={isCurrent ? 'page' : undefined}
            title={episode.title}
            className={cn(
              'flex min-h-9 items-center gap-2 rounded-sm px-2 text-[11.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              isCurrent
                ? 'bg-white/[0.1] text-white'
                : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <span className="shrink-0 font-mono tabular-nums text-zinc-400">
              {number ? `Ep ${number}` : 'Ep'}
            </span>
            {isCurrent ? <span className="sr-only">Episode sedang diputar: </span> : null}
            <span className="min-w-0 truncate">{episode.title}</span>
          </Link>
        ) : (
          <span className="flex min-h-9 items-center gap-2 px-2 text-[11.5px] text-zinc-400">
            <span className="shrink-0 font-mono tabular-nums">{number ? `Ep ${number}` : 'Ep'}</span>
            <span className="min-w-0 truncate">{episode.title}</span>
          </span>
        )}
      </li>
    );
  };

  return (
    <details
      className="group relative"
      onToggle={(event) => {
        const details = event.currentTarget;
        onOpenChange?.(details.open);
        if (details.open) {
          requestAnimationFrame(() => {
            const menu = details.querySelector<HTMLElement>('[data-episode-picker-menu]');
            menu?.scrollIntoView({
              block: 'end',
              inline: 'nearest',
            });
            requestAnimationFrame(() => {
              const bottom = menu?.getBoundingClientRect().bottom ?? 0;
              if (bottom > window.innerHeight) {
                window.scrollBy(0, Math.ceil(bottom - window.innerHeight));
              }
            });
          });
        }
      }}
    >
      <summary
        aria-label="Pilih episode"
        title="Pilih episode"
        className="flex h-12 cursor-pointer list-none flex-col items-center justify-center rounded-md px-2.5 transition-colors duration-150 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:h-11 [&::-webkit-details-marker]:hidden"
      >
        <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-zinc-400">
          Episode
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold leading-none tabular-nums text-zinc-100">
          <List className="size-3.5 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
          {episodes.find((episode) => episode.slug && currentPath.endsWith(`/${episode.slug}`))?.number ||
            episodeNumberFromTitle(
              episodes.find((episode) => episode.slug && currentPath.endsWith(`/${episode.slug}`))?.title || ''
            ) ||
            '—'}
          {episodeTotal > 0 ? (
            <span className="text-[11px] font-normal text-zinc-400">/ {episodeTotal}</span>
          ) : null}
        </span>
      </summary>
      <div
        data-episode-picker-menu
        className="absolute left-1/2 top-full z-40 mt-2 max-h-[min(45vh,26rem)] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-md border border-line bg-elevated p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]"
      >
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
          Episode {seriesTitle ? `· ${seriesTitle}` : ''}
        </p>
        {malzSearch ? (
          <form onSubmit={(event) => void searchEpisodes(event)} className="flex gap-1.5 px-1 pb-2">
            <label className="sr-only" htmlFor="player-episode-search">
              Cari nomor episode
            </label>
            <input
              id="player-episode-search"
              type="text"
              inputMode="decimal"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'player-episode-search-error' : undefined}
              placeholder="Nomor episode"
              className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-black/20 px-2.5 text-[12px] text-white placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            />
            <button
              type="submit"
              disabled={searching}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-white/15 px-2.5 text-[11px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
            >
              {searching ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              Cari
            </button>
          </form>
        ) : null}
        {results ? (
          <>
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              Hasil pencarian
            </p>
            {results.length > 0 ? (
              <ul aria-label="Hasil pencarian episode" className="grid grid-cols-2 gap-1">
                {results.map(renderEpisode)}
              </ul>
            ) : null}
            {error ? (
              <p id="player-episode-search-error" role="status" className="px-2 py-2 text-[11px] text-zinc-400">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
        {episodes.length > 0 ? (
          <ul aria-label="Pilih episode" className="grid grid-cols-2 gap-1">
            {episodes.map(renderEpisode)}
          </ul>
        ) : (
          <p className="px-2 py-3 text-[12px] text-zinc-400">Daftar episode belum tersedia.</p>
        )}
        <Link
          href={allEpisodesHref}
          prefetch={false}
          className="mt-2 flex min-h-9 items-center rounded-sm border-t border-line px-2 pt-2 text-[11.5px] font-medium text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Buka halaman seri
        </Link>
      </div>
    </details>
  );
}
