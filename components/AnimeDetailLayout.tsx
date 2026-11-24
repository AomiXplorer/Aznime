import { Suspense } from 'react';
import Link from 'next/link';
import { Play, Star } from 'lucide-react';
import type { AniListTrailer } from '@/lib/scraper/types';
import type { AnimeCardItem, DownloadBox, EpisodeSummary } from '@/lib/scraper/types';
import { getAniListTrailer } from '@/lib/anilist';
import { getHidoriTitleIndex, isKnownTitle } from '@/lib/sources';
import { serializeJsonLd } from '@/lib/json-ld';
import { AnimeImage } from './AnimeImage';
import { AnimeTrailerSection } from './AnimeTrailerSection';
import { DownloadBoxes } from './DownloadBoxes';
import { AnimeGrid } from './AnimeGrid';

export interface AnimeDetailView {
  title: string;
  altTitle: string | null;
  poster: string | null;
  /** Poster Malz dilayani CDN pihak ketiga, jadi tidak boleh lewat optimizer Next. */
  posterUnoptimized?: boolean;
  rating: string | null;
  synopsis: string | null;
  info: Record<string, string>;
  genres: { name: string; slug: string | null }[];
  totalEpisodes: number;
  startEpisode: EpisodeSummary | null;
  latestEpisode: EpisodeSummary | null;
  trailer: AniListTrailer | null;
  deferTrailer?: boolean;
  banner: string | null;
  downloadBoxes: DownloadBox[];
  recommendations: AnimeCardItem[];
  filterKnownRecommendations?: boolean;
  jsonLd: Record<string, unknown>;
  episodesSlot: React.ReactNode;
  /** Awalan rute pemutar untuk tombol "Mulai menonton" (default /watch). */
  episodeHrefBase?: string;
  /** Tombol favorit (client component) di baris aksi. */
  favoriteSlot?: React.ReactNode;
}

function epSuffix(number: string | null): string {
  if (!number) return '';
  return /^\d+(\.\d+)?$/.test(number) ? ` (Ep ${number})` : ` (${number})`;
}

async function DeferredAnimeTrailer({
  title,
  altTitle,
}: {
  title: string;
  altTitle: string | null;
}) {
  const trailer = await getAniListTrailer(title, altTitle).catch(() => null);
  return <AnimeTrailerSection title={title} trailer={trailer} />;
}

async function DeferredAnimeRecommendations({
  items,
}: {
  items: AnimeCardItem[];
}) {
  const index = await getHidoriTitleIndex();
  const filtered = items.filter((item) => !isKnownTitle(item, index));
  if (filtered.length === 0) return null;

  return (
    <section aria-label="Rekomendasi anime serupa" className="space-y-4">
      <h2 className="text-lg font-bold text-white">Mungkin kamu suka</h2>
      <AnimeGrid items={filtered.slice(0, 14)} fillRows />
    </section>
  );
}

export function AnimeDetailLayout({
  title,
  altTitle,
  poster,
  posterUnoptimized,
  rating,
  synopsis,
  info,
  genres,
  totalEpisodes,
  startEpisode,
  latestEpisode,
  trailer,
  deferTrailer = false,
  banner,
  downloadBoxes,
  recommendations,
  filterKnownRecommendations = false,
  jsonLd,
  episodesSlot,
  episodeHrefBase = '/watch',
  favoriteSlot,
}: AnimeDetailView) {
  const infoEntries = Object.entries(info).filter(([, val]) => Boolean(val));

  return (
    <div className="pb-8">
      <section className="relative -mt-0 overflow-hidden bg-canvas">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {banner ? (
            <AnimeImage src={banner} alt="" priority sizes="100vw" className="object-cover object-center opacity-60" />
          ) : (
            <AnimeImage
              src={poster}
              alt=""
              priority
              unoptimized={posterUnoptimized}
              sizes="100vw"
              className="object-cover object-top opacity-30"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/70 to-canvas/30" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-[200px_1fr] lg:grid-cols-[230px_1fr] lg:px-8">
          <div className="mx-auto w-40 md:mx-0 md:w-full">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface shadow-2xl shadow-black/70 ring-1 ring-white/10">
              <AnimeImage
                src={poster}
                alt={title}
                priority
                unoptimized={posterUnoptimized}
                sizes="(max-width: 768px) 160px, 230px"
              />
            </div>
          </div>

          <div className="space-y-4 self-end">
            <div className="space-y-1.5">
              {altTitle ? <p className="text-xs text-zinc-400 sm:text-[13px]">{altTitle}</p> : null}
              <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-white [text-wrap:balance] sm:text-[34px]">
                {title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-zinc-300">
              {rating ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                  <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                  {rating}
                </span>
              ) : null}
              {info.Status ? <span>{info.Status}</span> : null}
              {info.Tipe || info.Type ? <span>{info.Tipe || info.Type}</span> : null}
              {totalEpisodes > 1 ? <span>{totalEpisodes} episode</span> : null}
            </div>

            {genres.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Genre">
                {genres.map((genre, idx) =>
                  genre.slug ? (
                    <Link
                      key={`${genre.slug}-${idx}`}
                      href={`/anime?genre=${encodeURIComponent(genre.slug)}`}
                      className="rounded-[4px] bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/20 hover:text-white"
                    >
                      {genre.name}
                    </Link>
                  ) : (
                    <span
                      key={`${genre.name}-${idx}`}
                      className="rounded-[4px] bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200"
                    >
                      {genre.name}
                    </span>
                  )
                )}
              </div>
            ) : null}

            {synopsis ? (
              <p className="max-w-3xl text-sm leading-relaxed text-zinc-300">{synopsis}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {startEpisode?.slug ? (
                <Link
                  href={`${episodeHrefBase}/${encodeURIComponent(startEpisode.slug)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-black transition-colors hover:bg-white/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Mulai menonton{epSuffix(startEpisode.number)}
                </Link>
              ) : null}

              {latestEpisode?.slug && latestEpisode.slug !== startEpisode?.slug ? (
                <Link
                  href={`${episodeHrefBase}/${encodeURIComponent(latestEpisode.slug)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-white/20 px-5 text-sm font-bold text-white transition-colors hover:bg-white/30 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Episode terbaru{epSuffix(latestEpisode.number)}
                </Link>
              ) : null}

              {favoriteSlot ? <div className="inline-flex h-11 items-center">{favoriteSlot}</div> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pt-6 sm:px-6 lg:px-8">
        {infoEntries.length > 0 ? (
          <section aria-label="Informasi anime">
            <h2 className="mb-4 text-lg font-bold text-white">Informasi</h2>
            <dl className="grid gap-4 rounded-[6px] border border-[#241d1d] bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
              {infoEntries.map(([key, val]) => (
                <div key={key} className="space-y-0.5">
                  <dt className="text-xs text-muted">{key}</dt>
                  <dd className="text-sm font-semibold text-zinc-100">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {deferTrailer ? (
          <Suspense fallback={null}>
            <DeferredAnimeTrailer title={title} altTitle={altTitle} />
          </Suspense>
        ) : (
          <AnimeTrailerSection title={title} trailer={trailer} />
        )}

        <section aria-label="Daftar episode" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-white">Episode</h2>
            {totalEpisodes > 1 ? (
              <span className="text-xs text-muted">{totalEpisodes} episode</span>
            ) : null}
          </div>
          {episodesSlot}
        </section>

        <DownloadBoxes boxes={downloadBoxes} heading="Unduh paket batch" />

        {filterKnownRecommendations ? (
          <Suspense fallback={null}>
            <DeferredAnimeRecommendations items={recommendations} />
          </Suspense>
        ) : recommendations.length > 0 ? (
          <section aria-label="Rekomendasi anime serupa" className="space-y-4">
            <h2 className="text-lg font-bold text-white">Mungkin kamu suka</h2>
            <AnimeGrid items={recommendations.slice(0, 14)} fillRows />
          </section>
        ) : null}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    </div>
  );
}
