'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { EpisodeSummary } from '@/lib/scraper/types';
import { EpisodeList } from './EpisodeList';

interface MalzEpisodeListProps {
  animeId: string;
  seriesTitle?: string | null;
  initialEpisodes: EpisodeSummary[];
  initialPage: number;
  perPage: number;
  currentSlug?: string | null;
}

interface EpisodeResponse {
  items?: EpisodeSummary[];
  hasMore?: boolean;
  error?: string;
}

/**
 * API Malz mengirim 30 episode per halaman, jadi seri panjang (mis. Naruto 500
 * episode) tidak mungkin dimuat sekaligus. Halaman pertama dirender di server,
 * sisanya diambil saat penonton memintanya.
 */
export function MalzEpisodeList({
  animeId,
  seriesTitle,
  initialEpisodes,
  initialPage,
  perPage,
  currentSlug,
}: MalzEpisodeListProps) {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>(initialEpisodes);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialEpisodes.length >= perPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const res = await fetch(
        `/api/malz/episodes?id=${encodeURIComponent(animeId)}&page=${nextPage}${seriesTitle ? `&title=${encodeURIComponent(seriesTitle)}` : ''}`
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
      <EpisodeList episodes={episodes} currentSlug={currentSlug} />

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
