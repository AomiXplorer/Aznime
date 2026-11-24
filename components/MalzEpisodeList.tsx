'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { EpisodeSummary } from '@/lib/scraper/types';
import { EpisodeList } from './EpisodeList';
import { matchesEpisodeQuery } from '@/lib/episode-format';

interface MalzEpisodeListProps {
  animeId: string;
  initialEpisodes: EpisodeSummary[];
  initialPage: number;
  perPage: number;
  currentSlug?: string | null;
  totalCount?: number;
  minAvailableEpisode?: number | null;
}

interface EpisodeResponse {
  items?: EpisodeSummary[];
  hasMore?: boolean;
  error?: string;
}

/**
 * API Malz mengirim 30 episode per halaman, jadi seri panjang (mis. Naruto 500
 * episode) tidak mungkin dimuat sekaligus. Halaman pertama dimuat setelah
 * detail anime tampil; sisanya diambil saat penonton memintanya.
 */
export function MalzEpisodeList({
  animeId,
  initialEpisodes,
  initialPage,
  perPage,
  currentSlug,
  totalCount,
  minAvailableEpisode,
}: MalzEpisodeListProps) {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>(initialEpisodes);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialEpisodes.length >= perPage);
  const [loading, setLoading] = useState(initialEpisodes.length === 0);
  const [initialLoading, setInitialLoading] = useState(initialEpisodes.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const searchRun = useRef(0);
  const searchTimer = useRef<number | undefined>(undefined);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [availableMinimum, setAvailableMinimum] = useState(minAvailableEpisode ?? null);
  const [checkingRangeBounds, setCheckingRangeBounds] = useState(minAvailableEpisode == null);

  useEffect(() => {
    if (availableMinimum !== null) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      id: animeId,
      highest: String(totalCount || 0),
      perPage: String(perPage),
    });

    void fetch(`/api/malz/minimum?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { minimumEpisode?: number | null; error?: string };
        if (!response.ok) throw new Error(data.error || 'Gagal memeriksa ketersediaan episode');
        setAvailableMinimum(data.minimumEpisode ?? null);
        setCheckingRangeBounds(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setCheckingRangeBounds(false);
        setRangeError(err instanceof Error ? err.message : 'Gagal memeriksa ketersediaan episode');
      });

    return () => controller.abort();
  }, [animeId, availableMinimum, perPage, totalCount]);

  useEffect(() => () => {
    window.clearTimeout(searchTimer.current);
    searchRun.current += 1;
  }, []);

  useEffect(() => {
    if (initialEpisodes.length > 0) return;
    const controller = new AbortController();

    void fetch(`/api/malz/episodes?id=${encodeURIComponent(animeId)}&page=0`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as EpisodeResponse;
        if (!response.ok) throw new Error(data.error || 'Gagal memuat episode');
        setEpisodes(data.items || []);
        setPage(0);
        setHasMore(Boolean(data.hasMore));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat episode');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setInitialLoading(false);
        }
      });

    return () => controller.abort();
  }, [animeId, initialEpisodes.length]);

  const searchAllEpisodes = useCallback((query: string) => {
    window.clearTimeout(searchTimer.current);
    const run = ++searchRun.current;
    const normalized = query.trim();
    setError(null);
    setSearchMessage(null);

    if (!normalized || episodes.some((episode) => matchesEpisodeQuery(episode, normalized))) {
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const number = normalized.match(/^(?:episode\s*)?(\d+(?:\.\d+)?)$/i)?.[1];
        const loadedNumbers = episodes
          .map((episode) => Number(episode.number || ''))
          .filter((value) => Number.isFinite(value) && value > 0);
        const newest = Math.max(totalCount || 0, ...loadedNumbers);

        const fetchPage = async (targetPage: number): Promise<EpisodeResponse> => {
          const response = await fetch(
            `/api/malz/episodes?id=${encodeURIComponent(animeId)}&page=${targetPage}`
          );
          const data = (await response.json()) as EpisodeResponse;
          if (!response.ok) throw new Error(data.error || 'Gagal mencari episode');
          return data;
        };

        if (number) {
          const target = Number(number);
          const estimatedPage =
            newest > 0 && perPage > 0
              ? Math.max(0, Math.floor((newest - target) / perPage))
              : 0;
          const pages = [...new Set([estimatedPage - 1, estimatedPage, estimatedPage + 1])]
            .filter((targetPage) => targetPage >= 0);
          const pageResults = await Promise.all(pages.map(fetchPage));
          if (run !== searchRun.current) return;
          const matches = pageResults.flatMap((result) => result.items || [])
            .filter((episode) => matchesEpisodeQuery(episode, normalized));
          if (matches.length > 0) {
            setEpisodes((previous) => {
              const bySlug = new Map(previous.map((episode) => [episode.slug, episode]));
              matches.forEach((episode) => bySlug.set(episode.slug, episode));
              return [...bySlug.values()].sort(
                (a, b) => Number(b.number || 0) - Number(a.number || 0)
              );
            });
            setSearchMessage(`Episode ${number} ditemukan.`);
          } else {
            setSearchMessage(`Episode ${number} tidak ditemukan di arsip yang tersedia.`);
          }
          return;
        }

        let targetPage = 0;
        let found = false;
        const searchPageLimit = 20;
        while (targetPage < searchPageLimit) {
          if (run !== searchRun.current) return;
          const result = await fetchPage(targetPage);
          if (run !== searchRun.current) return;
          const items = result.items || [];
          const matches = items.filter((episode) => matchesEpisodeQuery(episode, normalized));
          if (matches.length > 0) {
            setEpisodes((previous) => {
              const bySlug = new Map(previous.map((episode) => [episode.slug, episode]));
              matches.forEach((episode) => bySlug.set(episode.slug, episode));
              return [...bySlug.values()].sort(
                (a, b) => Number(b.number || 0) - Number(a.number || 0)
              );
            });
            found = true;
            break;
          }
          if (!result.hasMore || items.length === 0) break;
          targetPage += 1;
        }
        if (run === searchRun.current) {
          setSearchMessage(
            found
              ? 'Hasil pencarian ditambahkan ke daftar.'
              : targetPage >= searchPageLimit
                ? 'Belum ditemukan di 20 halaman pertama. Coba nomor episode tepat atau muat episode lainnya.'
                : 'Tidak ada episode yang cocok di arsip.'
          );
        }
      } catch (err) {
        if (run === searchRun.current) {
          setError(err instanceof Error ? err.message : 'Gagal mencari episode');
        }
      } finally {
        if (run === searchRun.current) setSearching(false);
      }
    }, 350);
  }, [animeId, episodes, perPage, totalCount]);

  const loadRange = useCallback(async (range: { start: number; end: number } | null) => {
    if (!range) return;
    setRangeLoading(true);
    setRangeError(null);
    try {
      const numbers = episodes
        .map((episode) => Number(episode.number || ''))
        .filter((number) => Number.isFinite(number) && number > 0);
      const newest = Math.max(totalCount || 0, ...numbers);
      if (!newest || !perPage) throw new Error('Kelompok episode tidak dapat ditentukan.');

      const firstPage = Math.max(0, Math.floor((newest - range.end) / perPage));
      const lastPage = Math.max(firstPage, Math.floor((newest - range.start) / perPage));
      const pageNumbers = Array.from(
        { length: Math.min(lastPage - firstPage + 1, 20) },
        (_, index) => firstPage + index
      );
      const responses = await Promise.all(
        pageNumbers.map(async (targetPage) => {
          const response = await fetch(
            `/api/malz/episodes?id=${encodeURIComponent(animeId)}&page=${targetPage}`
          );
          const data = (await response.json()) as EpisodeResponse;
          if (!response.ok) throw new Error(data.error || 'Gagal memuat kelompok episode');
          return data;
        })
      );
      const incoming = responses.flatMap((response) => response.items || []);
      setEpisodes((previous) => {
        const bySlug = new Map(previous.map((episode) => [episode.slug, episode]));
        incoming.forEach((episode) => bySlug.set(episode.slug, episode));
        return [...bySlug.values()].sort(
          (a, b) => Number(b.number || 0) - Number(a.number || 0)
        );
      });
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Gagal memuat kelompok episode');
    } finally {
      setRangeLoading(false);
    }
  }, [animeId, episodes, perPage, totalCount]);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const res = await fetch(
        `/api/malz/episodes?id=${encodeURIComponent(animeId)}&page=${nextPage}`
      );
      const data = (await res.json()) as EpisodeResponse;
      if (!res.ok) throw new Error(data.error || 'Gagal memuat episode berikutnya');

      const incoming = data.items || [];
      setEpisodes((prev) => {
        const seen = new Set(prev.map((ep) => ep.slug));
        return [...prev, ...incoming.filter((ep) => !seen.has(ep.slug))];
      });
      setPage(nextPage);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat episode berikutnya');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {initialLoading ? (
        <p role="status" className="py-5 text-[12.5px] text-zinc-400">
          Memuat daftar episode…
        </p>
      ) : (
        <EpisodeList
          episodes={episodes}
          currentSlug={currentSlug}
          onSearch={searchAllEpisodes}
          searching={searching}
          searchMessage={searchMessage}
          totalCount={totalCount}
          minAvailableEpisode={availableMinimum}
          rangeBoundsLoading={checkingRangeBounds}
          onRangeChange={(range) => void loadRange(range)}
        />
      )}

      {rangeLoading ? (
        <p role="status" className="inline-flex items-center gap-2 text-[12px] text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Memuat episode terpilih…
        </p>
      ) : null}
      {rangeError ? (
        <p role="alert" className="text-[12px] text-rose-400">
          {rangeError}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12px] text-rose-400">
          {error}
        </p>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-4 text-[12.5px] font-semibold text-zinc-200 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : null}
          {loading ? 'Memuat episode' : 'Muat episode lainnya'}
        </button>
      ) : null}
    </div>
  );
}
