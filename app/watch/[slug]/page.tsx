import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getDetail, getEpisode, UpstreamError } from '@/lib/scraper';
import { VideoPlayer } from '@/components/VideoPlayer';
import { DownloadBoxes } from '@/components/DownloadBoxes';
import { EpisodeList } from '@/components/EpisodeList';
import { ErrorState } from '@/components/ErrorState';

export const revalidate = 120;

interface WatchPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  try {
    const ep = await getEpisode(decodedSlug);
    if (!ep.title) return { title: 'Nonton anime' };
    return {
      title: ep.title,
      description: `Nonton streaming ${ep.title} subtitle Indonesia di Aznime. Pemutar otomatis memilih server tercepat.`,
    };
  } catch {
    return { title: 'Nonton anime' };
  }
}

export default async function WatchEpisodePage({ params }: WatchPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  let episode = null;
  let upstreamError: string | null = null;
  try {
    episode = await getEpisode(decodedSlug);
  } catch (err) {
    if (err instanceof UpstreamError && err.isNotFound) {
      notFound();
    }
    upstreamError = err instanceof Error ? err.message : 'Gagal memuat episode dari server sumber.';
  }

  if (upstreamError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState title="Gagal memuat pemutar episode" message={upstreamError} />
      </div>
    );
  }

  if (!episode || !episode.title) {
    notFound();
  }

  const seriesSlug = episode.series?.slug || episode.navigation.all?.slug || null;
  const seriesDetail = seriesSlug ? await getDetail(seriesSlug).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Link href="/" className="transition-colors hover:text-white">
            Beranda
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          {seriesSlug ? (
            <Link
              href={`/anime/${encodeURIComponent(seriesSlug)}`}
              className="transition-colors hover:text-white"
            >
              {seriesDetail?.title || episode.series?.title || 'Detail seri'}
            </Link>
          ) : (
            <Link href="/anime" className="transition-colors hover:text-white">
              Anime
            </Link>
          )}
        </nav>

        <h1 className="text-xl font-extrabold leading-snug text-white [text-wrap:balance] sm:text-2xl">
          {episode.title}
        </h1>
      </div>

      <VideoPlayer
        key={decodedSlug}
        title={episode.title}
        servers={episode.servers}
        defaultEmbed={episode.defaultEmbed}
        navigation={episode.navigation}
        seriesSlug={seriesSlug}
      />

      <DownloadBoxes boxes={episode.downloads} heading="Unduh episode ini" />

      {seriesDetail && seriesDetail.episodes.length > 0 ? (
        <section aria-label="Semua episode dalam seri ini" className="space-y-4 border-t border-white/[0.07] pt-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-bold text-white">Episode lainnya</h2>
            <span className="text-xs text-muted">{seriesDetail.totalEpisodes} episode</span>
          </div>
          <EpisodeList episodes={seriesDetail.episodes} />
        </section>
      ) : null}
    </div>
  );
}
