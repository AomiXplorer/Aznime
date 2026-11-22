'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { PopularAnimeItem } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';
import { cn } from '@/lib/cn';

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

const CHAMPION_TAG: Record<PeriodKey, string> = {
  weekly: 'Juara minggu ini',
  monthly: 'Juara bulan ini',
  alltime: 'Juara terbaik',
};

function itemHref(item: PopularAnimeItem): string {
  return item.slug ? `/anime/${encodeURIComponent(item.slug)}` : '/anime';
}

export function PopularRanking({ weekly, monthly, alltime }: PopularRankingProps) {
  const [period, setPeriod] = useState<PeriodKey>('weekly');
  const map: Record<PeriodKey, PopularAnimeItem[]> = { weekly, monthly, alltime };
  const list = map[period].slice(0, 5);
  const champion = list[0] || null;
  const runners = list.slice(1);

  if (weekly.length === 0 && monthly.length === 0 && alltime.length === 0) return null;

  return (
    <section aria-label="Top 5 anime populer" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.1rem] font-bold text-white">Top 5 populer</h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Peringkat dari yang paling banyak ditonton.
          </p>
        </div>
        <div role="tablist" aria-label="Periode peringkat" className="flex gap-1 rounded-full bg-white/[0.04] p-1">
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'cursor-pointer whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                  active ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {champion ? (
        <div className="space-y-3">
          {/* Juara 1: panggung utama, poster besar + nomor kuat. */}
          <Link
            href={itemHref(champion)}
            prefetch={false}
            className="group flex overflow-hidden rounded-xl border border-white/[0.08] bg-surface transition-colors duration-200 hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <div className="relative aspect-[2/3] w-[42%] max-w-[260px] shrink-0 overflow-hidden">
              <AnimeImage
                src={champion.poster}
                alt={champion.title}
                unoptimized={champion.source === 'malz'}
                sizes="(max-width: 640px) 42vw, 260px"
                className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
              />
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-rose-300">
                  {CHAMPION_TAG[period]}
                </span>
                <span className="mt-0.5 block text-[2.6rem] font-black leading-none tracking-tighter text-white sm:text-[3rem]">
                  01
                </span>
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                Peringkat 1
              </span>
              <h3 className="line-clamp-3 text-[1.02rem] font-extrabold leading-snug text-white sm:text-[1.25rem] lg:text-[1.45rem]">
                {champion.title}
              </h3>
              {champion.genres.length > 0 ? (
                <p className="line-clamp-1 text-[11.5px] text-zinc-400">
                  {champion.genres.slice(0, 3).join(' · ')}
                </p>
              ) : null}
              <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 transition-colors duration-150 group-hover:text-white">
                Lihat detail
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </Link>

          {/* Peringkat 2-5: baris ranking, nomor outline jadi penanda utama. */}
          <ol className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
            {runners.map((item, index) => {
              const rank = index + 2;
              const isRunnerUp = rank <= 3;
              return (
                <li key={`${period}-${item.slug || item.postId || rank}`}>
                  <Link
                    href={itemHref(item)}
                    prefetch={false}
                    className="group flex h-full items-center gap-3 rounded-xl border border-white/[0.05] bg-[#0f1116] px-2.5 py-2.5 transition-colors duration-150 hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:gap-4 sm:px-3"
                  >
                    <span className="sr-only">Peringkat {rank}: </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'rank-numeral shrink-0 text-right font-black tabular-nums leading-none tracking-tighter',
                        isRunnerUp
                          ? 'rank-numeral-strong w-11 text-[2.5rem] sm:w-14 sm:text-[3rem]'
                          : 'rank-numeral-soft w-9 text-[2rem] sm:w-12 sm:text-[2.4rem]'
                      )}
                    >
                      {rank}
                    </span>

                    <div
                      className={cn(
                        'relative shrink-0 overflow-hidden rounded-md bg-surface ring-1 ring-white/[0.08]',
                        isRunnerUp
                          ? 'h-[84px] w-[58px] sm:h-[92px] sm:w-[64px]'
                          : 'h-[70px] w-[48px] sm:h-[80px] sm:w-[56px]'
                      )}
                    >
                      <AnimeImage
                        src={item.poster}
                        alt={item.title}
                        unoptimized={item.source === 'malz'}
                        sizes={isRunnerUp ? '64px' : '56px'}
                        className="transition-transform duration-300 ease-out group-hover:scale-[1.05]"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-zinc-100 transition-colors duration-150 group-hover:text-white">
                        {item.title}
                      </h3>
                      {item.genres.length > 0 ? (
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {item.genres.slice(0, 2).join(' · ')}
                        </p>
                      ) : null}
                    </div>

                    <ChevronRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-zinc-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="rounded-xl border border-white/[0.07] bg-surface p-6 text-center text-sm text-zinc-400">
          Belum ada data peringkat untuk periode ini.
        </p>
      )}
    </section>
  );
}
