import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
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
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
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

  // Metadata sebagai satu baris teks, bukan deretan badge: lebih ringkas dan
  // hierarkinya tidak bersaing dengan judul.
  const meta: Array<{ label: string; dot?: string }> = [
    episodeNumber
      ? { label: /^\d/.test(episodeNumber) ? `Episode ${episodeNumber}` : episodeNumber }
      : null,
    season ? { label: season } : null,
    { label: 'Sub Indo' },
    status ? { label: status, dot: status === 'Sedang tayang' ? 'bg-emerald-400' : 'bg-zinc-500' } : null,
  ].filter(Boolean) as Array<{ label: string; dot?: string }>;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <header className="mb-3 sm:mb-4">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[11px] text-zinc-500"
        >
          <Link href="/" className="shrink-0 transition-colors duration-150 hover:text-zinc-300">
            Beranda
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          {seriesSlug ? (
            <Link
              href={`/anime/${encodeURIComponent(seriesSlug)}`}
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
          {cleanTitle}
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
      <div className="-mx-4 sm:mx-0">
        <VideoPlayer
          key={decodedSlug}
          title={cleanTitle}
          servers={episode.servers}
          defaultEmbed={episode.defaultEmbed}
          navigation={navigation}
          seriesSlug={seriesSlug}
          seriesTitle={seriesTitle}
        />
      </div>

      <div className="mt-7 space-y-9 sm:mt-8 sm:space-y-10">
        <DownloadBoxes boxes={episode.downloads} heading="Unduh episode" />

        {seriesDetail && seriesDetail.episodes.length > 0 ? (
          <section aria-label="Semua episode dalam seri ini" id="episode-lainnya" className="scroll-mt-20">
            <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.08] pb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-zinc-200">
                Episode lainnya
              </h2>
              <span className="text-[11px] tabular-nums text-zinc-500">
                {seriesDetail.totalEpisodes} episode
              </span>
            </div>
            <EpisodeList episodes={seriesDetail.episodes} currentSlug={decodedSlug} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
