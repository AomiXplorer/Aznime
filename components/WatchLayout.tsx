import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { DownloadBox } from '@/lib/scraper/types';
import { serializeJsonLd } from '@/lib/json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';
import { DownloadBoxes } from './DownloadBoxes';

export interface WatchMetaItem {
  label: string;
  dot?: string;
}

interface WatchLayoutProps {
  seriesTitle: string;
  seriesHref: string | null;
  title: string;
  meta: WatchMetaItem[];
  player: React.ReactNode;
  downloadBoxes: DownloadBox[];
  downloadHeading: string;
  episodeCount: number;
  episodesSlot: React.ReactNode | null;
  /**
   * Path halaman ini (mis. `/watch/naruto-episode-1`). Bila diisi, breadcrumb
   * terlihat di atas juga dikirim sebagai BreadcrumbList. Bagian dewasa tidak
   * mengisinya karena halamannya sengaja tidak diindeks.
   */
  breadcrumbPath?: string;
}

export function WatchLayout({
  seriesTitle,
  seriesHref,
  title,
  meta,
  player,
  downloadBoxes,
  downloadHeading,
  episodeCount,
  episodesSlot,
  breadcrumbPath,
}: WatchLayoutProps) {
  const breadcrumbJson = breadcrumbPath
    ? breadcrumbJsonLd([
        { name: 'Beranda', path: '/' },
        seriesHref
          ? { name: seriesTitle, path: seriesHref }
          : { name: 'Katalog anime', path: '/anime' },
        { name: title, path: breadcrumbPath },
      ])
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <header className="mb-3 sm:mb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-zinc-500">
          <Link href="/" className="shrink-0 transition-colors duration-150 hover:text-zinc-300">
            Beranda
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          {seriesHref ? (
            <Link
              href={seriesHref}
              className="min-w-0 truncate transition-colors duration-150 hover:text-zinc-300"
            >
              {seriesTitle}
            </Link>
          ) : (
            <Link href="/anime" className="transition-colors duration-150 hover:text-zinc-300">
              Anime
            </Link>
          )}
        </nav>

        <h1 className="mt-1.5 text-[18px] font-bold leading-snug tracking-tight text-white [text-wrap:balance] sm:text-[22px]">
          {title}
        </h1>

        {meta.length > 0 ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-none text-zinc-400">
            {meta.map((item, idx) => (
              <span key={item.label} className="inline-flex items-center gap-2">
                {idx > 0 ? (
                  <span aria-hidden="true" className="text-zinc-600">
                    ·
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  {item.dot ? (
                    <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} aria-hidden="true" />
                  ) : null}
                  {item.label}
                </span>
              </span>
            ))}
          </p>
        ) : null}
      </header>

      {/* Di HP pemutar menyentuh tepi layar supaya area tonton maksimal. */}
      <div className="-mx-4 sm:mx-0">{player}</div>

      <div className="mt-7 space-y-9 sm:mt-8 sm:space-y-10">
        <DownloadBoxes boxes={downloadBoxes} heading={downloadHeading} />

        {episodesSlot ? (
          <section aria-label="Semua episode dalam seri ini" id="episode-lainnya" className="scroll-mt-20">
            <div className="flex items-baseline justify-between gap-3 border-b border-[#2b2222] pb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-zinc-200">
                Episode lainnya
              </h2>
              <span className="text-[11px] tabular-nums text-zinc-500">
                {episodeCount} episode
              </span>
            </div>
            {episodesSlot}
          </section>
        ) : null}
      </div>

      {breadcrumbJson ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJson) }}
        />
      ) : null}
    </div>
  );
}
