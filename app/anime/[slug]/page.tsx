import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Play, Star } from 'lucide-react';
import { getDetail, UpstreamError } from '@/lib/scraper';
import { getAniListTrailer } from '@/lib/anilist';
import { AnimeImage } from '@/components/AnimeImage';
import { AnimeTrailerSection } from '@/components/AnimeTrailerSection';
import { EpisodeList } from '@/components/EpisodeList';
import { DownloadBoxes } from '@/components/DownloadBoxes';
import { AnimeGrid } from '@/components/AnimeGrid';
import { ErrorState } from '@/components/ErrorState';

export const revalidate = 300;

interface AnimeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AnimeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  try {
    const detail = await getDetail(decodedSlug);
    if (!detail.title) return { title: 'Anime tidak ditemukan' };

    const description = detail.synopsis
      ? detail.synopsis.slice(0, 155).trim()
      : `Tonton dan unduh ${detail.title} subtitle Indonesia lengkap di Aznime.`;

    return {
      title: detail.title,
      description,
      openGraph: {
        type: 'video.tv_show',
        title: `${detail.title} | Aznime`,
        description,
        images: detail.poster ? [{ url: detail.poster, alt: detail.title }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${detail.title} | Aznime`,
        description,
        images: detail.poster ? [detail.poster] : undefined,
      },
    };
  } catch {
    return { title: 'Detail anime' };
  }
}

function epSuffix(number: string | null): string {
  if (!number) return '';
  return /^\d+(\.\d+)?$/.test(number) ? ` (Ep ${number})` : ` (${number})`;
}

export default async function AnimeDetailPage({ params }: AnimeDetailPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  let detail = null;
  let upstreamError: string | null = null;
  try {
    detail = await getDetail(decodedSlug);
  } catch (err) {
    if (err instanceof UpstreamError && err.isNotFound) {
      notFound();
    }
    upstreamError = err instanceof Error ? err.message : 'Gagal memuat detail anime dari server sumber.';
  }

  if (upstreamError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState title="Gagal memuat detail anime" message={upstreamError} />
      </div>
    );
  }

  if (!detail || !detail.title) {
    notFound();
  }

  const trailer = await getAniListTrailer(detail.title, detail.altTitle).catch(() => null);
  const banner = trailer?.bannerImage || null;

  // Episode dari sumber biasanya terbaru dulu; episode pertama ada di akhir daftar.
  const firstEpisode = detail.episodes.length > 0 ? detail.episodes[detail.episodes.length - 1] : null;
  const latestEpisode = detail.episodes.length > 0 ? detail.episodes[0] : null;

  const infoEntries = Object.entries(detail.info).filter(([, val]) => Boolean(val));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: detail.title,
    alternateName: detail.altTitle || undefined,
    description: detail.synopsis || undefined,
    image: detail.poster || undefined,
    genre: detail.genres.map((g) => g.name),
    numberOfEpisodes: detail.totalEpisodes || undefined,
  };

  return (
    <div className="pb-8">
      <section className="relative -mt-0 overflow-hidden bg-canvas">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {banner ? (
            <AnimeImage src={banner} alt="" priority sizes="100vw" className="object-cover object-center opacity-60" />
          ) : (
            <AnimeImage
              src={detail.poster}
              alt=""
              priority
              sizes="100vw"
              className="scale-110 object-cover object-top opacity-40 blur-2xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/70 to-canvas/30" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-[200px_1fr] lg:grid-cols-[230px_1fr] lg:px-8">
          <div className="mx-auto w-40 md:mx-0 md:w-full">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface shadow-2xl shadow-black/70 ring-1 ring-white/10">
              <AnimeImage src={detail.poster} alt={detail.title} priority sizes="(max-width: 768px) 160px, 230px" />
            </div>
          </div>

          <div className="space-y-4 self-end">
            <div className="space-y-1.5">
              {detail.altTitle ? <p className="text-xs text-zinc-400 sm:text-[13px]">{detail.altTitle}</p> : null}
              <h1 className="text-2xl font-extrabold leading-tight text-white [text-wrap:balance] sm:text-[2rem]">
                {detail.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-zinc-300">
              {detail.rating ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                  <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                  {detail.rating}
                </span>
              ) : null}
              {detail.info.Status ? <span>{detail.info.Status}</span> : null}
              {detail.info.Tipe || detail.info.Type ? <span>{detail.info.Tipe || detail.info.Type}</span> : null}
              <span>{detail.totalEpisodes} episode</span>
            </div>

            {detail.genres.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Genre">
                {detail.genres.map((g, idx) => (
                  <Link
                    key={`${g.slug || idx}`}
                    href={g.slug ? `/anime?genre=${encodeURIComponent(g.slug)}` : '/anime'}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            ) : null}

            {detail.synopsis ? (
              <p className="max-w-3xl text-sm leading-relaxed text-zinc-300">{detail.synopsis}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {firstEpisode?.slug ? (
                <Link
                  href={`/watch/${encodeURIComponent(firstEpisode.slug)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-black transition-all hover:bg-white/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Mulai menonton{epSuffix(firstEpisode.number)}
                </Link>
              ) : null}

              {latestEpisode?.slug && latestEpisode.slug !== firstEpisode?.slug ? (
                <Link
                  href={`/watch/${encodeURIComponent(latestEpisode.slug)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-white/20 px-5 text-sm font-bold text-white backdrop-blur transition-all hover:bg-white/30 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Episode terbaru{epSuffix(latestEpisode.number)}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 pt-6 sm:px-6 lg:px-8">
        {infoEntries.length > 0 ? (
          <section aria-label="Informasi anime">
            <h2 className="mb-4 text-lg font-bold text-white">Informasi</h2>
            <dl className="grid gap-4 rounded-xl bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
              {infoEntries.map(([key, val]) => (
                <div key={key} className="space-y-0.5">
                  <dt className="text-xs text-muted">{key}</dt>
                  <dd className="text-sm font-semibold text-zinc-100">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <AnimeTrailerSection title={detail.title} trailer={trailer} />

        <section aria-label="Daftar episode" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-white">Episode</h2>
            <span className="text-xs text-muted">{detail.totalEpisodes} episode</span>
          </div>
          <EpisodeList episodes={detail.episodes} />
        </section>

        <DownloadBoxes boxes={detail.batchDownloads} heading="Unduh paket batch" />

        {detail.recommendations.length > 0 ? (
          <section aria-label="Rekomendasi anime serupa" className="space-y-4">
            <h2 className="text-lg font-bold text-white">Mungkin kamu suka</h2>
            <AnimeGrid items={detail.recommendations.slice(0, 14)} />
          </section>
        ) : null}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
