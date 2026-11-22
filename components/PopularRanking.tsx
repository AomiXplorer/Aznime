'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { PopularAnimeItem } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';
import { CompactRankingRow, SpotlightRankingCard } from './RankingCard';
import { SectionHeading } from './SectionHeading';

interface PopularRankingProps {
  weekly: PopularAnimeItem[];
  monthly: PopularAnimeItem[];
  alltime: PopularAnimeItem[];
}

type PeriodKey = 'weekly' | 'monthly' | 'alltime';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'alltime', label: 'All Time' },
];

const MAX_ITEMS = 5;

function itemHref(item: PopularAnimeItem): string {
  return item.slug ? `/anime/${encodeURIComponent(item.slug)}` : '/anime';
}

export function PopularRanking({ weekly, monthly, alltime }: PopularRankingProps) {
  const [period, setPeriod] = useState<PeriodKey>('weekly');
  const reduce = useReducedMotion();

  const map: Record<PeriodKey, PopularAnimeItem[]> = { weekly, monthly, alltime };
  const list = map[period].slice(0, MAX_ITEMS);

  if (weekly.length === 0 && monthly.length === 0 && alltime.length === 0) {
    return (
      <section aria-label="Top 5 anime populer" className="space-y-5">
        <SectionHeading title="Top 5 populer" />
        <div
          role="status"
          className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted"
        >
          <p className="font-semibold text-ink">Gagal memuat ranking.</p>
          <p className="mt-1">Coba lagi nanti.</p>
        </div>
      </section>
    );
  }

  const spotlight = list[0] ?? null;
  const runnersUp = list.slice(1, MAX_ITEMS);

  return (
    <section aria-label="Top 5 anime populer" className="relative space-y-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 -top-8 -bottom-4 -z-10"
        style={{
          background:
            'radial-gradient(circle at 18% 35%, rgba(225, 29, 72, 0.08), transparent 55%)',
        }}
      />

      <SectionHeading title="Top 5 populer">
        <div
          role="tablist"
          aria-label="Periode peringkat"
          className="inline-flex items-center rounded-full border border-line bg-surface p-1"
        >
          {PERIODS.map((p) => {
            const isOn = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={isOn}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'relative h-7 cursor-pointer whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink',
                  isOn ? 'text-white' : 'text-muted hover:text-ink'
                )}
              >
                {isOn ? (
                  <motion.span
                    layoutId="popular-period-pill"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 450, damping: 34 }
                    }
                    className="absolute inset-0 rounded-full bg-accent"
                  />
                ) : null}
                <span className="relative z-10">{p.label}</span>
              </button>
            );
          })}
        </div>
      </SectionHeading>

      {list.length === 0 ? (
        <div
          role="status"
          className="flex min-h-[240px] items-center justify-center rounded-2xl border border-line bg-surface px-4 text-center text-sm text-muted"
        >
          Belum ada data ranking untuk periode ini.
        </div>
      ) : (
        <div
          key={period}
          role="tabpanel"
          aria-label={`Daftar populer ${PERIODS.find((p) => p.key === period)?.label ?? ''}`}
          className="page-enter grid gap-4 lg:grid-cols-12 lg:items-stretch"
        >
          {spotlight ? (
            <div className="lg:col-span-5">
              <SpotlightRankingCard
                item={spotlight}
                rank={1}
                href={itemHref(spotlight)}
              />
            </div>
          ) : null}

          {runnersUp.length > 0 ? (
            <div className="flex flex-col justify-between gap-3 lg:col-span-7">
              {runnersUp.map((item, idx) => (
                <CompactRankingRow
                  key={`${period}-${item.slug || idx + 2}`}
                  item={item}
                  rank={idx + 2}
                  href={itemHref(item)}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
