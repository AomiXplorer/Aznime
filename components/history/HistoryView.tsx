'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Play, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { readGuestHistory, removeGuestHistory } from '@/lib/guest-history';
import type { HistoryItem } from '@/lib/auth/history';

export function formatRelative(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Baru saja';
  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
  ];
  const formatter = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
  for (const { unit, seconds } of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'Baru saja';
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 border border-line bg-surface p-2.5">
      <div className="h-[86px] w-[60px] shrink-0 animate-pulse rounded-[3px] bg-white/[0.06]" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

export function HistoryView() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!user) {
      setItems(readGuestHistory());
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/history', { cache: 'no-store' });
      if (!response.ok) throw new Error('gagal');
      const data = (await response.json()) as { items?: HistoryItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError('Riwayat tidak bisa dimuat. Coba muat ulang halaman.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  async function remove(animeId: string) {
    setItems((current) => current.filter((item) => item.animeId !== animeId));
    if (!user) {
      removeGuestHistory(animeId);
      return;
    }
    await fetch(`/api/history?animeId=${encodeURIComponent(animeId)}`, { method: 'DELETE' }).catch(
      () => undefined
    );
  }

  if (authLoading || loading) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonRow key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-line bg-surface px-4 py-6 text-center">
        <p className="text-[13px] text-zinc-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex h-8 cursor-pointer items-center rounded-[4px] border border-line px-3 text-[12px] font-medium text-zinc-200 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-line bg-surface px-5 py-10 text-center">
        <Clock className="mx-auto h-5 w-5 text-zinc-600" aria-hidden="true" />
        <p className="mt-3 text-[13.5px] font-medium text-zinc-200">Belum ada riwayat menonton</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-[12.5px] leading-relaxed text-zinc-500">
          {user
            ? 'Episode yang kamu buka akan muncul di sini dan tersedia lagi di perangkat lain.'
            : 'Buka episode apa saja dan riwayatnya tersimpan di browser ini. Masuk untuk menyimpannya ke akun.'}
        </p>
        <Link
          href="/anime"
          className="mt-4 inline-flex h-8 items-center rounded-[4px] bg-accent-strong px-3.5 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-accent"
        >
          Jelajahi katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.animeId}
          className="group flex gap-3 border border-line bg-surface p-2.5 transition-colors duration-150 hover:border-zinc-700"
        >
          <Link
            href={item.episodeSlug ? `/watch/${encodeURIComponent(item.episodeSlug)}` : '/anime'}
            className="relative h-[86px] w-[60px] shrink-0 overflow-hidden rounded-[3px] bg-elevated"
          >
            {item.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.poster}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : null}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <Play className="h-4 w-4 text-white" aria-hidden="true" />
            </span>
          </Link>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-semibold leading-snug text-white">
              <Link href={`/anime/${encodeURIComponent(item.animeId)}`} className="hover:underline">
                {item.title}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-[11.5px] text-zinc-400">
              {item.episodeNumber ? `Episode ${item.episodeNumber}` : 'Episode terakhir'}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-600">{formatRelative(item.updatedAt)}</p>

            <div className="mt-2 flex items-center gap-1.5">
              {item.episodeSlug ? (
                <Link
                  href={`/watch/${encodeURIComponent(item.episodeSlug)}`}
                  className="inline-flex h-7 items-center gap-1 rounded-[3px] bg-accent-strong px-2.5 text-[11.5px] font-semibold text-white transition-colors duration-150 hover:bg-accent"
                >
                  <Play className="h-3 w-3" aria-hidden="true" />
                  Lanjutkan
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void remove(item.animeId)}
                aria-label={`Hapus ${item.title} dari riwayat`}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[3px] border border-line text-zinc-400 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
