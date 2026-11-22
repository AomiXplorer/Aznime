'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Heart, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

interface FavoriteButtonProps {
  animeId: string;
  title: string;
  poster: string | null;
}

export function FavoriteButton({ animeId, title, poster }: FavoriteButtonProps) {
  const { user, loading, openAuth } = useAuth();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setActive(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    fetch('/api/favorites', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { items?: { animeId: string }[] } | null) => {
        if (cancelled) return;
        setActive(Boolean(data?.items?.some((item) => item.animeId === animeId)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [animeId, loading, user]);

  async function toggle() {
    if (busy) return;
    if (!user) {
      openAuth('login', pathname);
      return;
    }
    setBusy(true);
    const next = !active;
    setActive(next);
    try {
      const response = next
        ? await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ animeId, title, poster }),
          })
        : await fetch(`/api/favorites?animeId=${encodeURIComponent(animeId)}`, { method: 'DELETE' });
      if (!response.ok) setActive(!next);
    } catch {
      setActive(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={active}
      aria-label={active ? 'Hapus dari favorit' : 'Tambah ke favorit'}
      disabled={!ready && Boolean(user)}
      className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[4px] border px-3 text-[12.5px] font-medium transition-colors duration-150 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
        active
          ? 'border-accent/60 bg-accent/10 text-[#ffb3c0]'
          : 'border-line text-zinc-300 hover:border-zinc-600 hover:text-white'
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Heart className={`h-3.5 w-3.5 ${active ? 'fill-current' : ''}`} aria-hidden="true" />
      )}
      {active ? 'Favorit' : 'Favorit'}
    </button>
  );
}
