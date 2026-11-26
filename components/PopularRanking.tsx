'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { PopularAnimeItem } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';
import { cn } from '@/lib/cn';

interface PopularRankingProps {
  trending: PopularAnimeItem[];
  favorite: PopularAnimeItem[];
  mostViewed: PopularAnimeItem[];
}

type PeriodKey = 'trending' | 'favorite' | 'mostViewed';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'trending', label: 'Trending' },
  { key: 'favorite', label: 'Terfavorit' },
  { key: 'mostViewed', label: 'Paling ditonton' },
];

const CHAMPION_TAG: Record<PeriodKey, string> = {
  trending: 'Paling hangat',
  favorite: 'Paling difavoritkan',
  mostViewed: 'Paling banyak ditonton',
};

function itemHref(item: PopularAnimeItem): string {
  return item.slug ? `/anime/${encodeURIComponent(item.slug)}` : '/anime';
}

/**
 * Top 5 populer.
 *
 * Dua komposisi, satu bahasa desain:
 *
 * - Ponsel (di bawah `sm`): juara tampil sebagai kartu mendatar, poster di
 *   kiri dan teks di kanan, lalu peringkat 2-5 menumpuk sebagai baris ringkas.
 * - `sm` sampai `md`: baris 2-5 berpasangan dua kolom supaya lebar tablet
 *   tidak menyisakan ruang kosong di kanan.
 * - `md` ke atas: kolom kiri jadi sampul editorial setinggi penuh dengan
 *   nomor 01 di kepalanya dan teks menyatu di kaki sampul, kolom kanan berisi
 *   empat baris yang tingginya dibagi rata mengikuti tinggi sampul. Kedua
 *   kolom berada di satu baris grid, jadi tepi atas dan bawahnya selalu
 *   sejajar tanpa perlu tinggi tetap.
 *
 * Nomor peringkat memakai angka bergaris (outline) supaya hierarkinya kuat
 * tanpa bersaing dengan judul: 2-3 lebih tegas, 4-5 lebih redup.
 */
export function PopularRanking({ trending, favorite, mostViewed }: PopularRankingProps) {
  const [period, setPeriod] = useState<PeriodKey>('trending');
  const map: Record<PeriodKey, PopularAnimeItem[]> = { trending, favorite, mostViewed };
  const list = map[period].slice(0, 5);
  const champion = list[0] || null;
  const runners = list.slice(1);

  if (trending.length === 0 && favorite.length === 0 && mostViewed.length === 0) return null;

  return (
    <section aria-label="Top 5 anime populer" className="space-y-3">
      <div className="flex flex-col gap-2.5 border-b border-line pb-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-2">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white">
          Top 5 populer
        </h2>
        <div
          role="tablist"
          aria-label="Periode peringkat"
          className="flex gap-0.5 self-start rounded-[6px] border border-line bg-surface p-0.5 sm:self-auto sm:gap-1 sm:p-1"
        >
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
                  'inline-flex min-h-[36px] cursor-pointer items-center whitespace-nowrap rounded-[4px] px-3 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:min-h-[30px]',
                  active
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {champion ? (
        <div className="grid gap-2.5 md:grid-cols-[clamp(260px,30vw,340px)_minmax(0,1fr)] md:gap-3.5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          {/* Juara: panggung utama. */}
          <Link
            href={itemHref(champion)}
            prefetch={false}
            className="group relative flex overflow-hidden rounded-[6px] border border-line bg-surface transition-colors duration-200 hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:block"
          >
            <div className="relative aspect-[2/3] w-[40%] max-w-[240px] shrink-0 overflow-hidden md:w-full md:max-w-none">
              <AnimeImage
                src={champion.poster}
                alt={champion.title}
                proxyWidth={520}
                unoptimized={champion.source === 'malz'}
                sizes="(max-width: 767px) 40vw, (max-width: 1023px) 30vw, 400px"
              />
              {/* Tirai gelap: cukup untuk menahan teks, tidak sampai menutupi sampul. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent md:hidden"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-3/5 bg-gradient-to-t from-black via-black/80 to-transparent md:block"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 hidden h-28 bg-gradient-to-b from-black/75 to-transparent md:block"
              />

              {/* Sempit: label + nomor di kaki sampul. */}
              <span className="absolute inset-x-0 bottom-0 p-3 md:hidden">
                <span className="block truncate text-[10px] font-medium text-accent-soft">
                  {CHAMPION_TAG[period]}
                </span>
                <span className="mt-0.5 block font-display text-[2.4rem] font-semibold leading-none tracking-[-0.04em] text-white tabular-nums">
                  01
                </span>
              </span>

              {/* Lebar: nomor jadi penanda editorial di kepala sampul. */}
              <span className="absolute inset-x-0 top-0 hidden items-center gap-2.5 p-4 lg:p-5 md:flex">
                <span className="font-display text-[2.5rem] font-semibold leading-none tracking-[-0.05em] text-white tabular-nums">
                  01
                </span>
                <span aria-hidden="true" className="h-7 w-px shrink-0 bg-white/25" />
                <span className="text-[10px] font-medium uppercase leading-[1.3] tracking-[0.16em] text-accent-soft">
                  {CHAMPION_TAG[period]}
                </span>
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4 sm:p-5 md:absolute md:inset-x-0 md:bottom-0 md:block md:p-4 lg:p-5">
              <h3 className="line-clamp-3 font-display text-[16.5px] font-semibold leading-[1.25] tracking-[-0.02em] text-white sm:text-[19px] lg:text-[21px] xl:text-[23px]">
                {champion.title}
              </h3>
              {champion.genres.length > 0 ? (
                <p className="line-clamp-1 text-[11.5px] text-zinc-400 md:mt-1.5">
                  {champion.genres.slice(0, 3).join(' · ')}
                </p>
              ) : null}
              <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-400 transition-colors duration-150 group-hover:text-white md:mt-2.5">
                Lihat detail
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </Link>

          {/* Peringkat 2-5: baris ringkas, tinggi dibagi rata di layar lebar. */}
          <ol className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 md:grid-rows-4">
            {runners.map((item, index) => {
              const rank = index + 2;
              const isRunnerUp = rank <= 3;
              return (
                <li key={`${period}-${item.slug || item.postId || rank}`} className="min-h-0">
                  <Link
                    href={itemHref(item)}
                    prefetch={false}
                    className="group flex h-full items-center gap-3 rounded-[6px] border border-line-soft bg-surface px-2.5 py-2 transition-colors md:py-1.5 lg:py-2 duration-150 hover:border-white/[0.16] hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:gap-3.5 sm:px-3 md:gap-4 md:px-3.5"
                  >
                    <span className="sr-only">Peringkat {rank}: </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'rank-numeral w-8 shrink-0 text-right font-display text-[1.9rem] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:w-9 sm:text-[2.1rem] md:w-10 md:text-[2.2rem] lg:w-11 lg:text-[2.4rem]',
                        isRunnerUp ? 'rank-numeral-strong' : 'rank-numeral-soft'
                      )}
                    >
                      {rank}
                    </span>

                    <div className="relative aspect-[2/3] w-[52px] shrink-0 overflow-hidden rounded-[4px] bg-surface ring-1 ring-white/[0.08] sm:w-[56px] md:h-full md:w-auto">
                      <AnimeImage
                        src={item.poster}
                        alt={item.title}
                        proxyWidth={180}
                        unoptimized={item.source === 'malz'}
                        sizes="(max-width: 1024px) 56px, 90px"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-zinc-100 transition-colors duration-150 group-hover:text-white sm:text-[14px]">
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
        <p className="rounded-[6px] border border-line-soft bg-surface p-6 text-center text-[13px] text-zinc-400">
          Belum ada data peringkat untuk periode ini.
        </p>
      )}
    </section>
  );
}
