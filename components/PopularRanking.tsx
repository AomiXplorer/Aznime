'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PopularAnimeItem } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';

interface PopularRankingProps {
  weekly: PopularAnimeItem[];
  monthly: PopularAnimeItem[];
  alltime: PopularAnimeItem[];
}

type PeriodKey = 'weekly' | 'monthly' | 'alltime';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'weekly', label: 'Minggu ini' },
  { key: 'monthly', label: 'Bulan ini' },
  { key: 'alltime', label: 'Sepanjang masa' },
];

export function PopularRanking({ weekly, monthly, alltime }: PopularRankingProps) {
  const [period, setPeriod] = useState<PeriodKey>('weekly');
  const map: Record<PeriodKey, PopularAnimeItem[]> = { weekly, monthly, alltime };
  const list = map[period].slice(0, 5);

  if (weekly.length === 0 && monthly.length === 0 && alltime.length === 0) return null;

  return (
    <section aria-label="Top 5 anime populer" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.1rem] font-bold text-white">Top 5 populer</h2>
        <div role="tablist" aria-label="Periode peringkat" className="flex gap-1">
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.key)}
                className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  active ? 'bg-white text-black' : 'text-muted hover:text-white'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Di HP: grid 3 kolom tanpa geser mendatar. Dulu daftar ini memakai
          overflow-x-auto dan menahan gestur ke bawah, jadi halaman terasa
          tidak bisa digulir saat jari menyentuh area Top 5. */}
      <ol className="grid grid-cols-3 gap-x-2 gap-y-4 sm:hidden">
        {list.map((item, idx) => {
          const href = item.slug ? `/anime/${encodeURIComponent(item.slug)}` : '/anime';
          const rank = idx + 1;
          return (
            <li key={`${period}-m-${item.slug || idx}`}>
              <Link
                href={href}
                prefetch={false}
                className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <span className="sr-only">Peringkat {rank}: </span>
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface shadow-md shadow-black/40">
                  <AnimeImage src={item.poster} alt={item.title} sizes="33vw" />
                  <span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                    #{rank}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12px] font-semibold leading-4 text-zinc-200 group-hover:text-white">
                  {item.title}
                </p>
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Desktop: baris besar dengan angka peringkat, geser mendatar tetap ada. */}
      <ol className="no-scrollbar -mx-4 hidden snap-x gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:flex sm:px-6 lg:-mx-8 lg:px-8">
        {list.map((item, idx) => {
          const href = item.slug ? `/anime/${encodeURIComponent(item.slug)}` : '/anime';
          const rank = idx + 1;
          return (
            <li
              key={`${period}-${item.slug || idx}`}
              className="w-[212px] shrink-0 snap-start"
            >
              <Link
                href={href}
                prefetch={false}
                className="group relative flex items-end rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <span className="sr-only">Peringkat {rank}: </span>
                <span
                  aria-hidden="true"
                  className="rank-numeral -mr-5 select-none text-[9rem] font-extrabold leading-[0.78] tracking-tighter"
                >
                  {rank}
                </span>
                <div className="relative z-10 aspect-[2/3] w-[124px] shrink-0 overflow-hidden rounded-md bg-surface shadow-lg shadow-black/50 transition-transform duration-300 group-hover:-translate-y-1 group-active:scale-95">
                  <AnimeImage src={item.poster} alt={item.title} sizes="124px" />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
