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
import { SectionHeading } from '@/components/SectionHeading';

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
      alternates: { canonical: `/anime/${encodeURIComponent(decodedSlug)}` },
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
  const displayPoster = trailer?.coverImage || detail.poster;

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
    image: displayPoster || undefined,
    genre: detail.genres.map((g) => g.name),
    numberOfEpisodes: detail.totalEpisodes || undefined,
  };

  return (
    <div className="pb-8">
      <section className="relative overflow-hidden bg-canvas">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {banner ? (
            <>
              <AnimeImage
                src={banner}
                alt=""
                priority
                sizes="100vw"
                className="object-cover object-center opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/75 to-canvas/30" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent" />
            </>
          ) : (
            <>
              <div className="stage-pattern absolute inset-0 opacity-60" />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 22% 35%, rgba(225, 29, 72, 0.14), transparent 58%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent" />
            </>
          )}
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-[200px_1fr] lg:grid-cols-[230px_1fr] lg:px-8">
          <div className="mx-auto w-40 md:mx-0 md:w-full">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-surface shadow-[0_20px_50px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/15">
              <AnimeImage
                src={displayPoster}
                alt={detail.title}
                priority
                sizes="(max-width: 768px) 160px, 230px"
              />
            </div>
          </div>

          <div className="space-y-4 self-end">
            <div className="space-y-1.5">
              {detail.altTitle ? <p className="text-xs text-muted sm:text-[13px]">{detail.altTitle}</p> : null}
              <h1 className="font-display text-[1.9rem] font-bold leading-[1.08] text-ink [text-wrap:balance] sm:text-[2.5rem]">
                {detail.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted">
              {detail.rating ? (
                <span className="inline-flex items-center gap-1.5 font-mono font-bold tabular-nums text-ink">
                  <Star className="h-4 w-4 fill-accent-ink text-accent-ink" aria-hidden="true" />
                  {detail.rating}
                </span>
              ) : null}
              {detail.info.Status ? <span>{detail.info.Status}</span> : null}
              {detail.info.Tipe || detail.info.Type ? <span>{detail.info.Tipe || detail.info.Type}</span> : null}
              <span className="font-mono tabular-nums">{detail.totalEpisodes} episode</span>
            </div>

            {detail.genres.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Genre">
                {detail.genres.map((g, idx) => (
                  <Link
                    key={`${g.slug || idx}`}
                    href={g.slug ? `/anime?genre=${encodeURIComponent(g.slug)}` : '/anime'}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:bg-accent-soft hover:text-accent-ink"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            ) : null}

            {detail.synopsis ? (
              <p className="max-w-3xl text-sm leading-relaxed text-muted">{detail.synopsis}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {firstEpisode?.slug ? (
                <Link
                  href={`/watch/${encodeURIComponent(firstEpisode.slug)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-white transition-colors duration-150 hover:bg-accent-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Mulai menonton{epSuffix(firstEpisode.number)}
                </Link>
              ) : null}

              {latestEpisode?.slug && latestEpisode.slug !== firstEpisode?.slug ? (
                <Link
                  href={`/watch/${encodeURIComponent(latestEpisode.slug)}`}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface/90 px-5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-white/25 hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                >
                  Episode terbaru{epSuffix(latestEpisode.number)}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 pt-8 sm:px-6 lg:px-8">
        {infoEntries.length > 0 ? (
          <section aria-label="Informasi anime" className="space-y-4">
            <SectionHeading title="Informasi" />
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {infoEntries.map(([key, val]) => (
                <div key={key} className="space-y-1 rounded-xl border border-line bg-surface p-3.5">
                  <dt className="text-xs font-medium text-faint">{key}</dt>
                  <dd className="text-sm font-semibold text-ink">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <AnimeTrailerSection title={detail.title} trailer={trailer} />

        <section aria-label="Daftar episode" className="space-y-5">
          <SectionHeading title="Episode" description={`${detail.totalEpisodes} episode`} />
          <EpisodeList episodes={detail.episodes} />
        </section>

        <DownloadBoxes boxes={detail.batchDownloads} heading="Unduh paket batch" />

        {detail.recommendations.length > 0 ? (
          <section aria-label="Rekomendasi anime serupa" className="space-y-5">
            <SectionHeading title="Mungkin kamu suka" />
            <AnimeGrid items={detail.recommendations.slice(0, 14)} />
          </section>
        ) : null}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
