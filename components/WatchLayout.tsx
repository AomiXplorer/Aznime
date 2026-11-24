import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { DownloadBox } from '@/lib/scraper/types';
<<<<<<< HEAD
import { DownloadBoxes } from './DownloadBoxes';
=======
import { serializeJsonLd } from '@/lib/json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';
import { DownloadBoxes } from './DownloadBoxes';
import { SectionHeading } from './SectionHeading';
>>>>>>> c5dfbd0 (Update maintennace)

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
<<<<<<< HEAD
=======
  /**
   * Path halaman ini (mis. `/watch/naruto-episode-1`). Bila diisi, breadcrumb
   * terlihat di atas juga dikirim sebagai BreadcrumbList. Bagian dewasa tidak
   * mengisinya karena halamannya sengaja tidak diindeks.
   */
  breadcrumbPath?: string;
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
}: WatchLayoutProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <header className="mb-3 sm:mb-4">
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
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

<<<<<<< HEAD
        <h1 className="mt-1.5 text-[18px] font-bold leading-snug tracking-tight text-white [text-wrap:balance] sm:text-[22px]">
=======
        <h1 className="mt-2 text-[18px] font-bold leading-snug tracking-tight text-white [text-wrap:balance] sm:text-[22px]">
>>>>>>> c5dfbd0 (Update maintennace)
          {title}
        </h1>

        {meta.length > 0 ? (
<<<<<<< HEAD
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-none text-zinc-400">
=======
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-none text-zinc-400">
>>>>>>> c5dfbd0 (Update maintennace)
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

<<<<<<< HEAD
      <div className="mt-7 space-y-9 sm:mt-8 sm:space-y-10">
=======
      {/* Jarak vertikal memakai satu skala: mt-6/8 setelah pemutar dan
          space-y-8/10 antar bagian, supaya ritme halaman sama di semua lebar
          layar tanpa jarak yang berbeda-beda per komponen. */}
      <div className="mt-6 space-y-8 sm:mt-8 sm:space-y-10">
>>>>>>> c5dfbd0 (Update maintennace)
        <DownloadBoxes boxes={downloadBoxes} heading={downloadHeading} />

        {episodesSlot ? (
          <section aria-label="Semua episode dalam seri ini" id="episode-lainnya" className="scroll-mt-20">
<<<<<<< HEAD
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
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
    </div>
  );
}
