'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Play, Search } from 'lucide-react';
import type { EpisodeSummary } from '@/lib/scraper/types';
import { createEpisodeRanges, matchesEpisodeQuery } from '@/lib/episode-format';
import { cn } from '@/lib/cn';

interface EpisodeListProps {
  episodes: EpisodeSummary[];
  /** Slug episode yang sedang diputar, dipakai untuk menandai baris aktif. */
  currentSlug?: string | null;
  /** Awalan rute pemutar; halaman /hentai memakai /hentai/watch. */
  hrefBase?: string;
  onSearch?: (query: string) => void;
  searching?: boolean;
  searchMessage?: string | null;
  totalCount?: number;
  minAvailableEpisode?: number | null;
  rangeBoundsLoading?: boolean;
  onRangeChange?: (range: { start: number; end: number } | null) => void;
}

export function EpisodeList({
  episodes,
  currentSlug,
  hrefBase = '/watch',
  onSearch,
  searching = false,
  searchMessage,
  totalCount,
  minAvailableEpisode,
  rangeBoundsLoading = false,
  onRangeChange,
}: EpisodeListProps) {
  const [filterText, setFilterText] = useState('');
  const [reverseOrder, setReverseOrder] = useState(true);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [showAllEpisodes, setShowAllEpisodes] = useState(false);
  const episodeListId = useId();

  const visibleEpisodes = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const ranged = selectedRange
      ? episodes.filter((ep) => {
          const number = Number(ep.number || '');
          return Number.isFinite(number) && number >= selectedRange.start && number <= selectedRange.end;
        })
      : episodes;
    const base = reverseOrder ? [...ranged].reverse() : ranged;
    if (!q) return base;
    return base.filter((ep) => matchesEpisodeQuery(ep, q));
  }, [episodes, filterText, reverseOrder, selectedRange]);
  const collapsedEpisodes = useMemo(() => {
    const collapsed = visibleEpisodes.slice(0, 10);
    const currentEpisode = visibleEpisodes.find((episode) => episode.slug === currentSlug);
    if (currentEpisode && !collapsed.some((episode) => episode.slug === currentEpisode.slug)) {
      collapsed.push(currentEpisode);
    }
    return collapsed;
  }, [currentSlug, visibleEpisodes]);
  const isEpisodeListExpanded = Boolean(selectedRange) || showAllEpisodes || Boolean(filterText.trim());
  const displayedEpisodes = isEpisodeListExpanded ? visibleEpisodes : collapsedEpisodes;
  const hiddenEpisodeCount =
    selectedRange || filterText.trim() ? 0 : visibleEpisodes.length - collapsedEpisodes.length;

  // Nomor episode yang benar-benar tersedia di sumber.
  const { minEp, maxEp } = useMemo(() => {
    const numbers = episodes
      .map((ep) => Number((ep.number || '').trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (numbers.length === 0) return { minEp: null, maxEp: null };
    return { minEp: Math.min(...numbers), maxEp: Math.max(...numbers) };
  }, [episodes]);

  const hasRange = minEp !== null && maxEp !== null && minEp !== maxEp;
  const effectiveTotalCount = Math.max(totalCount || 0, maxEp || 0);
  const rangeMax = effectiveTotalCount;
  const knownMinimum =
    minAvailableEpisode ?? (totalCount === undefined ? minEp : null);
  const rangeOptions = useMemo(
    () => createEpisodeRanges(1, rangeMax),
    [rangeMax]
  );
  const selectedRangeValue = selectedRange ? `${selectedRange.start}-${selectedRange.end}` : 'all';
  const startsLate =
    minAvailableEpisode !== null && minAvailableEpisode !== undefined
      ? minAvailableEpisode > 1
      : minEp !== null &&
        minEp > 1 &&
        (totalCount === undefined || totalCount <= episodes.length);

  if (episodes.length === 0) {
    return <p className="py-5 text-[12.5px] text-zinc-400">Belum ada episode untuk judul ini.</p>;
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
            onChange={(e) => {
              setFilterText(e.target.value);
              if (selectedRange) {
                setSelectedRange(null);
                onRangeChange?.(null);
              }
              onSearch?.(e.target.value);
            }}
            placeholder="Cari nomor atau judul episode"
            aria-describedby={searching || searchMessage ? 'episode-search-status' : undefined}
            className="h-9 w-full rounded-md bg-white/[0.04] pl-8 pr-2.5 text-[12.5px] text-zinc-100 placeholder:text-zinc-400 transition-colors duration-150 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-accent/60"
          />
        </div>

        <button
          type="button"
          onClick={() => setReverseOrder((prev) => !prev)}
          aria-pressed={reverseOrder}
          aria-label={reverseOrder ? 'Urutan episode: terlama ke terbaru' : 'Urutan episode: terbaru ke terlama'}
          title={reverseOrder ? 'Urutan: terlama ke terbaru' : 'Urutan: terbaru ke terlama'}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{reverseOrder ? 'Terlama' : 'Terbaru'}</span>
        </button>
      </div>

      {hasRange || startsLate ? (
        <p className="pb-2 text-[11.5px] leading-relaxed text-zinc-400">
          {hasRange
            ? totalCount !== undefined && effectiveTotalCount > episodes.length
              ? `Episode yang sudah dimuat: ${minEp}–${maxEp} (${episodes.length} dari sekitar ${effectiveTotalCount}).`
              : `Tersedia episode ${minEp}–${maxEp} (${episodes.length} episode).`
            : null}
          {hasRange && startsLate ? ' ' : null}
          {startsLate
            ? `Sumber baru menyediakan episode ${minEp} ke atas, episode sebelumnya belum bisa diputar di sini.`
            : null}
        </p>
      ) : null}

      {searching || searchMessage ? (
        <p id="episode-search-status" role="status" className="pb-2 text-[11.5px] text-zinc-400">
          {searching ? 'Mencari di daftar episode lainnya…' : searchMessage}
        </p>
      ) : null}

      {rangeOptions.length > 0 ? (
        <div className="mb-3 rounded-md border border-white/10 bg-white/[0.025] p-2.5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-[11.5px] font-semibold text-zinc-200">Tampilkan episode</p>
            <p className="shrink-0 text-[10.5px] text-zinc-400">Geser untuk pilihan lain</p>
          </div>
          <div
            role="group"
            aria-label="Pilih kelompok episode"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
          >
            <button
              type="button"
              aria-pressed={selectedRangeValue === 'all'}
              onClick={() => {
                setSelectedRange(null);
                setFilterText('');
                setShowAllEpisodes(false);
                onSearch?.('');
                onRangeChange?.(null);
              }}
              className={cn(
                'h-8 shrink-0 cursor-pointer rounded-md border px-2.5 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                selectedRangeValue === 'all'
                  ? 'border-accent/50 bg-accent/15 text-white'
                  : 'border-white/10 text-zinc-300 hover:border-white/25 hover:bg-white/[0.05] hover:text-white'
              )}
            >
              Semua yang dimuat
            </button>
            {rangeOptions.map((range) => {
              const value = `${range.start}-${range.end}`;
              const isSelected = selectedRangeValue === value;
              const unavailable =
                knownMinimum !== null && knownMinimum !== undefined && range.end < knownMinimum;
              return (
                <button
                  key={range.start}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (isSelected || unavailable) return;
                    const selected = { start: range.start, end: range.end };
                    setFilterText('');
                    setShowAllEpisodes(false);
                    onSearch?.('');
                    setSelectedRange(selected);
                    onRangeChange?.(selected);
                  }}
                  className={cn(
                    'h-8 shrink-0 cursor-pointer rounded-md border px-2.5 text-[11px] font-medium tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50',
                    isSelected
                      ? 'border-accent/50 bg-accent/15 text-white'
                      : 'border-white/10 text-zinc-300 hover:border-white/25 hover:bg-white/[0.05] hover:text-white'
                  )}
                  title={unavailable ? `Episode sebelum ${knownMinimum} belum tersedia` : `Tampilkan episode ${range.label}`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {rangeBoundsLoading ? (
        <p role="status" className="pb-2 text-[11.5px] text-zinc-400">
          Memeriksa episode lain yang tersedia…
        </p>
      ) : null}

      {visibleEpisodes.length === 0 ? (
        <p className="py-5 text-[12.5px] text-zinc-400">
          {selectedRange
            ? `Episode ${selectedRange.start}–${selectedRange.end} belum dimuat atau tidak tersedia.`
            : `Tidak ada episode yang cocok dengan “${filterText}”.`}
        </p>
      ) : (
        <div
          className={
            selectedRange
              ? 'max-h-[min(60vh,24rem)] overflow-y-auto rounded-md border border-white/10 bg-white/[0.02] px-3'
              : undefined
          }
        >
          {selectedRange ? (
            <p className="sticky top-0 z-10 -mx-3 border-b border-white/10 bg-[#131010] px-3 py-2 text-[11px] font-semibold text-zinc-300">
              Episode {selectedRange.start}–{selectedRange.end}
              <span className="ml-1.5 font-normal text-zinc-400">· {visibleEpisodes.length} episode</span>
            </p>
          ) : null}
          <ul
            id={episodeListId}
            aria-label="Daftar episode"
            className={cn(
              'grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3',
              selectedRange ? 'sm:grid-cols-1 lg:grid-cols-1' : ''
            )}
          >
            {displayedEpisodes.map((ep, idx) => {
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
                        isActive ? 'text-accent-soft' : 'text-zinc-400'
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
        </div>
      )}
      {hiddenEpisodeCount > 0 ? (
        <button
          type="button"
          aria-expanded={isEpisodeListExpanded}
          aria-controls={episodeListId}
          onClick={() => setShowAllEpisodes((expanded) => !expanded)}
          className="mt-2 inline-flex h-9 cursor-pointer items-center rounded-md border border-white/10 px-3 text-[11.5px] font-medium text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {isEpisodeListExpanded ? 'Tampilkan lebih sedikit' : `Lihat ${hiddenEpisodeCount} episode lainnya`}
        </button>
      ) : null}
    </div>
  );
}
