import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { DownloadBox } from '@/lib/scraper/types';
import { serializeJsonLd } from '@/lib/json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';
import { DownloadBoxes } from './DownloadBoxes';
import { SectionHeading } from './SectionHeading';

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
      <header className="mb-3.5 sm:mb-5">
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

        <h1 className="mt-2 text-[18px] font-bold leading-snug tracking-tight text-white [text-wrap:balance] sm:text-[22px]">
          {title}
        </h1>

        {meta.length > 0 ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-none text-zinc-400">
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

      {/* Jarak vertikal memakai satu skala: mt-6/8 setelah pemutar dan
          space-y-8/10 antar bagian, supaya ritme halaman sama di semua lebar
          layar tanpa jarak yang berbeda-beda per komponen. */}
      <div className="mt-6 space-y-8 sm:mt-8 sm:space-y-10">
        <DownloadBoxes boxes={downloadBoxes} heading={downloadHeading} />

        {episodesSlot ? (
          <section aria-label="Semua episode dalam seri ini" id="episode-lainnya" className="scroll-mt-20">
            <SectionHeading title="Episode lainnya" meta={`${episodeCount} episode`} />
            <div className="mt-2">{episodesSlot}</div>
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
