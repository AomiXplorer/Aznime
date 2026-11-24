'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Heart, LogOut } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

const PROVIDER_LABEL: Record<string, string> = {
  email: 'Email & password',
  google: 'Google',
  discord: 'Discord',
};

export function ProfileView() {
  const { user, stats, loading, openAuth, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || user) return;
    openAuth('login', '/profile');
  }, [loading, openAuth, user]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-[4px] border border-line bg-surface" />;
  }

  if (!user) {
    return (
      <div className="border border-line bg-surface px-5 py-10 text-center">
        <p className="text-[13.5px] font-medium text-zinc-200">Masuk untuk melihat profil</p>
        <button
          type="button"
          onClick={() => openAuth('login', '/profile')}
          className="mt-4 inline-flex h-8 cursor-pointer items-center rounded-[4px] bg-accent-strong px-3.5 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-accent"
        >
          Masuk
        </button>
      </div>
    );
  }

  const joined = user.createdAt ? new Date(user.createdAt) : null;
  const joinedLabel =
    joined && !Number.isNaN(joined.getTime())
      ? joined.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-';

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-center gap-4 border border-line bg-surface p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-elevated text-[18px] font-semibold text-zinc-300">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            user.username.slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] leading-tight text-white">{user.username}</h2>
          <p className="mt-0.5 truncate text-[12.5px] text-zinc-400">{user.email}</p>
          <p className="mt-1 text-[11.5px] text-zinc-600">
            {PROVIDER_LABEL[user.provider] || user.provider} · bergabung {joinedLabel}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/history"
          className="border border-line bg-surface p-4 transition-colors duration-150 hover:border-zinc-700"
        >
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          <p className="mt-2 text-[22px] font-semibold leading-none text-white">{stats.history}</p>
          <p className="mt-1 text-[12px] text-zinc-400">Anime di riwayat</p>
        </Link>
        <Link
          href="/favorites"
          className="border border-line bg-surface p-4 transition-colors duration-150 hover:border-zinc-700"
        >
          <Heart className="h-4 w-4 text-accent" aria-hidden="true" />
          <p className="mt-2 text-[22px] font-semibold leading-none text-white">{stats.favorites}</p>
          <p className="mt-1 text-[12px] text-zinc-400">Anime favorit</p>
        </Link>
      </section>

      <section className="border border-line bg-surface p-4">
        <button
          type="button"
          onClick={() => {
            setBusy(true);
            void logout().finally(() => setBusy(false));
          }}
          disabled={busy}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[4px] border border-line px-3.5 text-[12.5px] font-medium text-zinc-200 transition-colors duration-150 hover:border-accent/60 hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Keluar dari akun
        </button>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-zinc-600">
          Riwayat dan favorit tetap tersimpan di akun dan tersedia lagi setelah kamu masuk kembali.
        </p>
      </section>
    </div>
  );
}
