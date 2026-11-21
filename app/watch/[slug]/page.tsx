import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Captions, ChevronRight, CircleDot, Hash } from 'lucide-react';
import { getDetail, getEpisode, UpstreamError } from '@/lib/scraper';
import type { EpisodeNavLink, EpisodeSummary } from '@/lib/scraper/types';
import { cleanEpisodeTitle, episodeNumberFromTitle } from '@/lib/episode-format';
import { VideoPlayer } from '@/components/VideoPlayer';
import { DownloadBoxes } from '@/components/DownloadBoxes';
import { EpisodeList } from '@/components/EpisodeList';
import { ErrorState } from '@/components/ErrorState';

export const revalidate = 120;

interface WatchPageProps {
  params: Promise<{ slug: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  ongoing: 'Sedang tayang',
  completed: 'Tamat',
  upcoming: 'Segera tayang',
  hiatus: 'Hiatus',
};

function translateStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS_LABEL[status.trim().toLowerCase()] || status;
}

function toNavLink(episode: EpisodeSummary | null): EpisodeNavLink | null {
  if (!episode) return null;
  return {
    title: episode.title,
    slug: episode.slug,
    url: episode.url,
    number: episode.number,
  };
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
      alternates: { canonical: `/watch/${encodeURIComponent(decodedSlug)}` },
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

  const seriesTitle = cleanEpisodeTitle(seriesDetail?.title || episode.series?.title || 'Detail seri');
  const episodeNumber =
    episodeNumberFromTitle(episode.title) ||
    seriesDetail?.episodes.find((ep) => ep.slug === decodedSlug)?.number ||
    null;

  const episodes = seriesDetail?.episodes ?? [];
  const currentIdx = episodes.findIndex(
    (ep) => ep.slug === decodedSlug || ep.url === episode.url
  );
  // Daftar episode dari sumber urut dari yang terbaru, jadi index + 1 lebih lama.
  const olderEpisode = currentIdx >= 0 ? episodes[currentIdx + 1] || null : null;
  const newerEpisode = currentIdx >= 0 ? episodes[currentIdx - 1] || null : null;

  const navigation = {
    prev: toNavLink(olderEpisode) || episode.navigation.prev,
    all: episode.navigation.all,
    next: toNavLink(newerEpisode) || episode.navigation.next,
  };

  const season = seriesDetail?.info['Season'] || null;
  const status = translateStatus(seriesDetail?.info['Status']);
  const cleanTitle = cleanEpisodeTitle(episode.title);

  const chips = [
    episodeNumber ? { icon: Hash, label: `Episode ${episodeNumber}` } : null,
    season ? { icon: CalendarDays, label: season } : null,
    { icon: Captions, label: 'Sub Indo' },
    status ? { icon: CircleDot, label: status } : null,
  ].filter(Boolean) as Array<{ icon: typeof Hash; label: string }>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <header className="mb-4 space-y-2.5">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
          <Link href="/" className="transition-colors hover:text-zinc-300">
            Beranda
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          {seriesSlug ? (
            <Link
              href={`/anime/${encodeURIComponent(seriesSlug)}`}
              className="truncate transition-colors hover:text-zinc-300"
            >
              {seriesTitle}
            </Link>
          ) : (
            <Link href="/anime" className="transition-colors hover:text-zinc-300">
              Anime
            </Link>
          )}
        </nav>

        <h1 className="line-clamp-2 text-lg font-bold leading-snug text-white [text-wrap:balance] sm:text-xl">
          {cleanTitle}
        </h1>

        <ul className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <li
              key={chip.label}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 text-[11px] font-medium text-zinc-400"
            >
              <chip.icon className="h-3 w-3 text-zinc-500" aria-hidden="true" />
              {chip.label}
            </li>
          ))}
        </ul>
      </header>

      <VideoPlayer
        key={decodedSlug}
        title={cleanTitle}
        servers={episode.servers}
        defaultEmbed={episode.defaultEmbed}
        navigation={navigation}
        seriesSlug={seriesSlug}
        seriesTitle={seriesTitle}
      />

      <div className="mt-6 space-y-6">
        <DownloadBoxes boxes={episode.downloads} heading="Unduh episode" />

        {seriesDetail && seriesDetail.episodes.length > 0 ? (
          <section
            aria-label="Semua episode dalam seri ini"
            className="space-y-4 border-t border-white/[0.07] pt-6"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-base font-bold text-white">Episode lainnya</h2>
              <span className="text-[11px] text-zinc-500">{seriesDetail.totalEpisodes} episode</span>
            </div>
            <EpisodeList episodes={seriesDetail.episodes} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
