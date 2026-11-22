'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PopularAnimeItem } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';
import { circularOffset, isWrapJump, stepIndex } from '@/lib/ranking-carousel';
import { RankingCard } from './RankingCard';
import { SectionHeading } from './SectionHeading';

interface PopularRankingProps {
  weekly: PopularAnimeItem[];
  monthly: PopularAnimeItem[];
  alltime: PopularAnimeItem[];
}

type PeriodKey = 'weekly' | 'monthly' | 'alltime';
type CalendarMark = '7' | '30' | 'inf';

const PERIODS: Array<{ key: PeriodKey; label: string; mark: CalendarMark }> = [
  { key: 'weekly', label: 'Rank Mingguan', mark: '7' },
  { key: 'monthly', label: 'Rank Bulanan', mark: '30' },
  { key: 'alltime', label: 'Rank All Time', mark: 'inf' },
];

const MAX_ITEMS = 5;
const SWIPE_THRESHOLD = 40;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION_MS = 300;

// Indeks = jarak kartu dari tengah (0 = aktif).
const X_FACTOR = [0, 1, 1.8];
const SCALE = [1, 0.84, 0.7];
const DIM = [0, 0.4, 0.6];

function CalendarIcon({ mark }: { mark: CalendarMark }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="3" y="4.5" width="18" height="16.5" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      {mark === 'inf' ? (
        <path
          d="M12 15.25C10.8 13.6 9.3 13.2 8.3 13.9C7.3 14.6 7.3 15.9 8.3 16.6C9.3 17.3 10.8 16.9 12 15.25C13.2 13.6 14.7 13.2 15.7 13.9C16.7 14.6 16.7 15.9 15.7 16.6C14.7 17.3 13.2 16.9 12 15.25Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <text x="12" y="18.3" textAnchor="middle" fontSize={mark === '30' ? 7.5 : 8.5} fontWeight="800" fill="currentColor">
          {mark}
        </text>
      )}
    </svg>
  );
}

export function PopularRanking({ weekly, monthly, alltime }: PopularRankingProps) {
  const [period, setPeriod] = useState<PeriodKey>('weekly');
  // `prev` menyimpan posisi sebelumnya agar kartu yang menyeberang sisi bisa
  // dipindah tanpa transisi (lihat isWrapJump).
  const [pos, setPos] = useState({ active: 0, prev: 0 });
  const startX = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const map: Record<PeriodKey, PopularAnimeItem[]> = { weekly, monthly, alltime };
  const list = map[period].slice(0, MAX_ITEMS);
  const n = list.length;
  const active = Math.min(pos.active, Math.max(n - 1, 0));

  const go = (delta: number) =>
    setPos((p) => ({ active: stepIndex(p.active, delta, n), prev: p.active }));
  const goTo = (idx: number) =>
    setPos((p) => (p.active === idx ? p : { active: idx, prev: p.active }));
  const selectPeriod = (key: PeriodKey) => {
    setPeriod(key);
    setPos({ active: 0, prev: 0 });
  };

  if (weekly.length === 0 && monthly.length === 0 && alltime.length === 0) {
    return (
      <section aria-label="Top 5 anime populer" className="space-y-5">
        <SectionHeading title="Top 5 populer" />
        <div
          role="status"
          className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-sm text-muted"
        >
          <p className="font-semibold text-ink">Gagal memuat ranking.</p>
          <p className="mt-1">Coba lagi nanti.</p>
        </div>
      </section>
    );
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX.current = e.clientX;
    suppressClick.current = false;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD && n > 1) {
      suppressClick.current = true;
      go(dx < 0 ? 1 : -1);
    }
  };
  const cancelSwipe = () => {
    startX.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  };

  const renderCard = (item: PopularAnimeItem, idx: number): ReactNode => {
    const off = circularOffset(idx, active, n);
    const prevOff = circularOffset(idx, Math.min(pos.prev, n - 1), n);
    const dist = Math.min(Math.abs(off), 2);
    const isActive = off === 0;
    const jump = isWrapJump(prevOff, off, n);
    const href = item.slug ? `/anime/${encodeURIComponent(item.slug)}` : '/anime';

    const style = {
      '--x': X_FACTOR[dist] * Math.sign(off),
      zIndex: 10 - dist,
      transform: `translate3d(calc(-50% + var(--x) * var(--step)), 0, 0) scale(${SCALE[dist]})`,
      transition: jump ? 'none' : `transform ${DURATION_MS}ms ${EASE}`,
    } as CSSProperties;

    return (
      <div
        key={`${period}-${item.slug || idx}`}
        className={cn(
          'absolute left-1/2 top-0 aspect-[2/3] w-[var(--w)] rounded-lg will-change-transform',
          isActive ? 'shadow-xl shadow-black/60' : 'shadow-md shadow-black/40'
        )}
        style={style}
      >
        <RankingCard
          item={item}
          rank={idx + 1}
          dist={dist}
          dim={DIM[dist]}
          priority={idx < 3}
          href={href}
          durationMs={DURATION_MS}
          ease={EASE}
          onClick={(e) => {
            if (suppressClick.current) {
              e.preventDefault();
              return;
            }
            if (!isActive) goTo(idx);
          }}
        />
      </div>
    );
  };

  return (
    <section aria-label="Top 5 anime populer" className="space-y-5">
      <SectionHeading title="Top 5 populer" />

      {n === 0 ? (
        <div
          role="status"
          className="flex min-h-[260px] items-center justify-center rounded-lg border border-line bg-surface px-4 text-center text-sm text-muted"
        >
          Belum ada data ranking untuk periode ini.
        </div>
      ) : (
        <div key={period} className="page-enter relative -mx-4 pb-2 pt-2 sm:-mx-6 lg:mx-0">
          <div
            role="group"
            aria-roledescription="carousel"
            aria-label="Top 5 anime populer"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelSwipe}
            onPointerLeave={cancelSwipe}
            onDragStart={(e) => e.preventDefault()}
            style={{ height: 'calc(var(--w) * 1.5)' }}
            className="relative touch-pan-y select-none rounded-lg outline-none [overflow-x:clip] [--w:min(58vw,224px)] [--step:calc(var(--w)*0.68)] focus-visible:ring-2 focus-visible:ring-accent-ink sm:[--w:232px] sm:[--step:calc(var(--w)*0.72)] lg:[--w:260px] lg:[--step:calc(var(--w)*0.88)]"
          >
            {list.map(renderCard)}
          </div>

          {n > 1 && (
            <>
              <button
                type="button"
                aria-label="Sebelumnya"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-line bg-canvas text-ink transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink sm:flex"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Berikutnya"
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-line bg-canvas text-ink transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink sm:flex"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="mt-3 flex justify-center">
                {list.map((item, idx) => (
                  <button
                    key={`dot-${period}-${item.slug || idx}`}
                    type="button"
                    aria-label={`Tampilkan anime ke-${idx + 1}`}
                    aria-current={idx === active}
                    onClick={() => goTo(idx)}
                    className="cursor-pointer p-1.5 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        'block h-1 rounded-full transition-all duration-200',
                        idx === active ? 'w-5 bg-accent' : 'w-1.5 bg-white/25'
                      )}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="sr-only" aria-live="polite">
            Peringkat {active + 1}: {list[active]?.title}
          </p>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Periode peringkat"
        className="mx-auto grid max-w-xl grid-cols-3 gap-2 sm:flex sm:max-w-none sm:justify-center"
      >
        {PERIODS.map((p) => {
          const isOn = period === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={isOn}
              onClick={() => selectPeriod(p.key)}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border px-2 py-2.5 text-[12px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink sm:flex-row sm:gap-2.5 sm:px-5 sm:text-[14px]',
                isOn
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-surface text-muted hover:border-white/20 hover:bg-elevated hover:text-ink'
              )}
            >
              <CalendarIcon mark={p.mark} />
              <span className="whitespace-nowrap">{p.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
