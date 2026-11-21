import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import { getSchedule } from '@/lib/scraper';
import { AnimeImage } from '@/components/AnimeImage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

export const metadata: Metadata = {
  title: 'Jadwal Tayang Anime',
  description:
    'Jadwal rilis anime subtitle Indonesia harian dari Senin sampai Minggu beserta jam tayang.',
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
      <div className="space-y-1 border-b border-white/10 pb-5">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold text-zinc-100 sm:text-3xl">
          <Calendar className="h-6 w-6 text-rose-400" aria-hidden="true" />
          Jadwal Tayang Harian
        </h1>
        <p className="text-sm text-zinc-400">
          Perkiraan waktu rilis episode terbaru anime ongoing per hari.
        </p>
      </div>

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
              <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-2">
                <h2 className="font-display text-xl font-semibold text-zinc-100">{day}</h2>
                <span className="font-mono text-xs tabular-nums text-zinc-400">
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
                      className="group flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#12141a] p-2.5 transition-colors duration-150 hover:border-white/25 hover:bg-[#181b23] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    >
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[#181b23]">
                        <AnimeImage src={item.poster} alt={item.title} sizes="56px" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="line-clamp-2 text-sm font-medium text-zinc-100 transition-colors duration-150 group-hover:text-rose-300">
                          {item.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          {item.releaseTime ? (
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-rose-300">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {item.releaseTime}
                            </span>
                          ) : null}
                          {item.episode ? (
                            <span className="font-mono tabular-nums text-zinc-400">
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
