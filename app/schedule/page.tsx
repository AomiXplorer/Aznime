import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { getSchedule } from '@/lib/scraper';
import { AnimeImage } from '@/components/AnimeImage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

import { PageHeader } from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Jadwal Tayang Anime',
  description:
    'Jadwal rilis anime subtitle Indonesia harian dari Senin sampai Minggu beserta jam tayang.',
  alternates: { canonical: '/schedule' },
};

export const revalidate = 300;

export default async function SchedulePage() {
  let schedule = null;
  let errorMsg: string | null = null;

  try {
    schedule = await getSchedule();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Gagal memuat jadwal tayang';
  }

  if (!schedule || errorMsg) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState
          title="Gagal memuat jadwal tayang"
          message={errorMsg || 'Terjadi kesalahan saat mengambil jadwal.'}
        />
      </div>
    );
  }

  const days = Object.entries(schedule);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Jadwal Tayang Harian"
        description="Perkiraan waktu rilis episode terbaru anime ongoing per hari."
      />

      {days.length === 0 ? (
        <EmptyState
          title="Jadwal belum tersedia"
          description="Belum ada jadwal rilis harian yang tercatat saat ini."
          actionLabel="Lihat Anime Ongoing"
          actionHref="/ongoing"
        />
      ) : (
        <div className="space-y-10">
          {days.map(([day, items]) => (
            <section key={day} aria-label={`Jadwal ${day}`} className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-line pb-2.5">
                <h2 className="font-display text-xl font-bold text-ink">{day}</h2>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {items.length} judul
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, idx) => {
                  const href = item.slug
                    ? `/anime/${encodeURIComponent(item.slug)}`
                    : '/ongoing';
                  return (
                    <Link
                      key={`${day}-${item.slug || idx}`}
                      href={href}
                      className="group flex items-center gap-3.5 rounded-xl border border-line bg-surface p-2.5 transition-colors duration-150 hover:border-line-accent hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-elevated ring-1 ring-white/[0.06]">
                        <AnimeImage src={item.poster} alt={item.title} sizes="56px" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <h3 className="line-clamp-2 text-sm font-semibold text-ink transition-colors duration-150 group-hover:text-accent-ink">
                          {item.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          {item.releaseTime ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-accent-ink">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {item.releaseTime}
                            </span>
                          ) : null}
                          {item.episode ? (
                            <span className="font-mono text-[11px] tabular-nums text-muted">
                              {item.episode}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
