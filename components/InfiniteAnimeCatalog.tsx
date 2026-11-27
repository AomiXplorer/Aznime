'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnimeCardItem, PaginationInfo } from '@/lib/scraper/types';
import { AnimeGrid } from './AnimeGrid';
import { AnimeGridSkeleton } from './Skeleton';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';

interface InfiniteAnimeCatalogProps {
  initialItems: AnimeCardItem[];
  initialPagination: PaginationInfo;
  apiPath: string;
  queryParams: Record<string, string | string[] | undefined>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string | null;
  emptyActionHref?: string | null;
  endLabel?: string;
}

function getStableItemKey(item: AnimeCardItem): string {
  return `${item.source}:${item.kind}:${item.slug || item.url || item.postId || item.title}`;
}

export function InfiniteAnimeCatalog({
  initialItems,
  initialPagination,
  apiPath,
  queryParams,
  emptyTitle = 'Belum ada anime ditemukan',
  emptyDescription = 'Coba ubah filter atau kata kunci pencarian Anda.',
  emptyActionLabel = 'Lihat Katalog Lengkap',
  emptyActionHref = '/anime',
  endLabel = 'anime',
}: InfiniteAnimeCatalogProps) {
  const [items, setItems] = useState<AnimeCardItem[]>(initialItems);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const querySignature = JSON.stringify({ apiPath, queryParams });
  // Simpan props awal terbaru di ref supaya effect reset hanya bergantung pada
  // signature query. Tanpa ini, setiap parent re-render (yang membuat referensi
  // array/objek baru) akan mereset seluruh daftar dan memicu render ulang besar.
  const initialRef = useRef({ items: initialItems, pagination: initialPagination });
  initialRef.current = { items: initialItems, pagination: initialPagination };

  useEffect(() => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    setItems(initialRef.current.items);
    setPagination(initialRef.current.pagination);
    setLoadingMore(false);
    setError(null);
  }, [querySignature]);

  const loadNextPage = useCallback(async () => {
    if (inFlightRef.current || !pagination.hasNextPage) return;

    const targetPage = pagination.nextPage || pagination.currentPage + 1;
    inFlightRef.current = true;
    setLoadingMore(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const sp = new URLSearchParams();
      sp.set('page', String(targetPage));

      for (const [key, val] of Object.entries(queryParams)) {
        if (!val) continue;
        if (Array.isArray(val)) {
          for (const entry of val) {
            if (entry) sp.append(key, entry);
          }
        } else {
          sp.set(key, val);
        }
      }

      const res = await fetch(`${apiPath}?${sp.toString()}`, {
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        results?: AnimeCardItem[];
        pagination?: PaginationInfo;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat halaman berikutnya');
      }

      const incoming = data.results || [];
      setItems((prev) => {
        const seen = new Set(prev.map(getStableItemKey));
        const uniqueIncoming = incoming.filter((item) => {
          const k = getStableItemKey(item);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return [...prev, ...uniqueIncoming];
      });

      if (data.pagination) {
        setPagination({
          ...data.pagination,
          hasNextPage: data.pagination.hasNextPage && incoming.length > 0,
        });
      } else {
        setPagination((prev) => ({
          ...prev,
          currentPage: targetPage,
          hasNextPage: false,
          nextPage: null,
        }));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Gagal memuat anime berikutnya');
    } finally {
      inFlightRef.current = false;
      if (!controller.signal.aborted) {
        setLoadingMore(false);
      }
    }
  }, [apiPath, pagination.currentPage, pagination.hasNextPage, pagination.nextPage, queryParams]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !pagination.hasNextPage || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadNextPage();
        }
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadNextPage, pagination.hasNextPage, error]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel ?? undefined}
        actionHref={emptyActionHref ?? undefined}
      />
    );
  }

  return (
    <div className="space-y-8">
      <AnimeGrid items={items} priorityCount={6} />

      {loadingMore ? <AnimeGridSkeleton count={6} /> : null}

      {error ? (
        <ErrorState
          title="Gagal memuat halaman berikutnya"
          message={error}
          onRetry={() => void loadNextPage()}
        />
      ) : null}

      <div ref={sentinelRef} className="py-2 text-center">
        {!pagination.hasNextPage && !loadingMore ? (
          <p className="text-sm text-zinc-400">
            Seluruh {endLabel} pada daftar ini sudah ditampilkan ({items.length} judul).
          </p>
        ) : !loadingMore && !error ? (
          <button
            type="button"
            onClick={() => void loadNextPage()}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-white/15 bg-[#131010] px-4 py-2 text-xs font-medium text-zinc-300 transition-colors duration-150 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            Muat lebih banyak
          </button>
        ) : null}
      </div>
    </div>
  );
}
