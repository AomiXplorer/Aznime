'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { RevealImage } from '@/components/media/RevealImage';
import { formatRelative } from '@/components/history/HistoryView';
import type { FavoriteItem } from '@/lib/auth/favorites';

export function FavoritesView() {
  const { user, loading: authLoading, openAuth } = useAuth();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/favorites', { cache: 'no-store' });
      if (!response.ok) throw new Error('gagal');
      const data = (await response.json()) as { items?: FavoriteItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError('Daftar favorit tidak bisa dimuat. Coba muat ulang halaman.');
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
    await fetch(`/api/favorites?animeId=${encodeURIComponent(animeId)}`, { method: 'DELETE' }).catch(
      () => undefined
    );
  }

  if (authLoading || loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-[4px] bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="border border-line bg-surface px-5 py-10 text-center">
        <Heart className="mx-auto h-5 w-5 text-zinc-600" aria-hidden="true" />
        <p className="mt-3 text-[13.5px] font-medium text-zinc-200">Favorit butuh akun</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-[12.5px] leading-relaxed text-zinc-500">
          Masuk untuk menyimpan anime ke daftar favorit dan membukanya lagi kapan saja, di perangkat mana pun.
        </p>
        <button
          type="button"
          onClick={() => openAuth('login', '/favorites')}
          className="mt-4 inline-flex h-8 cursor-pointer items-center rounded-[4px] bg-accent-strong px-3.5 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-accent"
        >
          Masuk
        </button>
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
        <Heart className="mx-auto h-5 w-5 text-zinc-600" aria-hidden="true" />
        <p className="mt-3 text-[13.5px] font-medium text-zinc-200">Belum ada anime favorit</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-[12.5px] leading-relaxed text-zinc-500">
          Tekan tombol Favorit di halaman anime untuk menaruhnya di sini.
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <article key={item.animeId} className="group">
          <div className="relative overflow-hidden rounded-[4px] border border-line bg-surface">
            <Link href={`/anime/${encodeURIComponent(item.animeId)}`} className="block aspect-[2/3]">
              <RevealImage
                src={item.poster}
                alt={item.title}
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-opacity duration-150 group-hover:opacity-90"
                fallback={
                  <span className="flex h-full w-full items-center justify-center text-[11px] text-zinc-600">
                    Tanpa poster
                  </span>
                }
              />
            </Link>
            <button
              type="button"
              onClick={() => void remove(item.animeId)}
              aria-label={`Hapus ${item.title} dari favorit`}
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[3px] bg-black/70 text-zinc-200 transition-colors duration-150 hover:bg-accent-strong hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <h3 className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-zinc-200">
            <Link href={`/anime/${encodeURIComponent(item.animeId)}`} className="hover:text-white">
              {item.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-600">{formatRelative(item.addedAt)}</p>
        </article>
      ))}
    </div>
  );
}
