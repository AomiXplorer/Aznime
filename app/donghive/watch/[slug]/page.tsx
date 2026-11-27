import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DonghivePlayer } from '@/components/DonghivePlayer';
import { EpisodeList } from '@/components/EpisodeList';
import { ErrorState } from '@/components/ErrorState';
import { WatchLayout, type WatchMetaItem } from '@/components/WatchLayout';
import {
  donghiveEpisodeSummary,
  getDonghiveDetail,
  getDonghiveEpisode,
} from '@/lib/donghive';
import { UpstreamError } from '@/lib/scraper/utils';
import type { EpisodeSummary } from '@/lib/scraper/types';

export const revalidate = 300;

interface DonghiveWatchPageProps {
  params: Promise<{ slug: string }>;
}

function slugFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '');
    return decodeURIComponent(pathname.split('/').pop() || '') || null;
  } catch {
    return null;
  }
}

function episodeMeta(number: string | null, date: string | null): WatchMetaItem[] {
  return [
    number ? { label: `Episode ${number}` } : null,
    date ? { label: date } : null,
    { label: 'Donghua' },
  ].filter(Boolean) as WatchMetaItem[];
}

export async function generateMetadata({ params }: DonghiveWatchPageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const episode = await getDonghiveEpisode(slug);
    return {
      title: episode.title,
      description: `Tonton ${episode.title} subtitle Indonesia di Aznime.`,
      alternates: { canonical: `/donghive/watch/${encodeURIComponent(episode.slug)}` },
    };
  } catch {
    return { title: 'DongHive' };
  }
}

export default async function DonghiveWatchPage({ params }: DonghiveWatchPageProps) {
  const { slug } = await params;
  let episode: Awaited<ReturnType<typeof getDonghiveEpisode>>;
  try {
    episode = await getDonghiveEpisode(slug);
  } catch (error) {
    if (error instanceof UpstreamError && error.isNotFound) notFound();
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState
          title="Gagal memuat episode DongHive"
          message={error instanceof Error ? error.message : 'DongHive tidak merespons.'}
        />
      </div>
    );
  }

  const seriesSlug = episode.series.slug || slugFromUrl(episode.navigation.allEpisodes);
  const detail = seriesSlug ? await getDonghiveDetail(seriesSlug).catch(() => null) : null;
  const summaries: EpisodeSummary[] = (detail?.episodes || [])
    .map(donghiveEpisodeSummary)
    .sort((a, b) => (Number.parseFloat(a.number || '') || 0) - (Number.parseFloat(b.number || '') || 0));
  const current = summaries.find((item) => item.slug === episode.slug);
  const currentIndex = current ? summaries.indexOf(current) : -1;
  const prevEpisode = currentIndex > 0 ? summaries[currentIndex - 1] : null;
  const nextEpisode = currentIndex >= 0 ? summaries[currentIndex + 1] || null : null;
  const prevSlug = prevEpisode?.slug || slugFromUrl(episode.navigation.prev);
  const nextSlug = nextEpisode?.slug || slugFromUrl(episode.navigation.next);
  const seriesTitle = detail?.title || episode.series.title || episode.title;
  const seriesHref = seriesSlug ? `/donghive/${encodeURIComponent(seriesSlug)}` : null;
  const image = episode.thumbnail || detail?.poster || null;
  const poster = image ? `/api/img?u=${encodeURIComponent(image)}&w=960&q=74&f=webp` : null;

  return (
    <WatchLayout
      seriesTitle={seriesTitle}
      seriesHref={seriesHref}
      title={episode.title}
      meta={episodeMeta(episode.episodeNumber, episode.releaseDate)}
      downloadBoxes={[]}
      downloadHeading="Unduhan"
      episodeCount={summaries.length}
      episodesSlot={
        summaries.length ? (
          <EpisodeList episodes={summaries} currentSlug={episode.slug} hrefBase="/donghive/watch" />
        ) : null
      }
      player={
        <DonghivePlayer
          key={episode.slug}
          title={episode.title}
          poster={poster}
          servers={episode.servers}
          navigation={{
            prev: prevSlug
              ? {
                  href: `/donghive/watch/${encodeURIComponent(prevSlug)}`,
                  label: `Episode sebelumnya ${prevEpisode?.number || ''}`.trim(),
                }
              : null,
            next: nextSlug
              ? {
                  href: `/donghive/watch/${encodeURIComponent(nextSlug)}`,
                  label: `Episode berikutnya ${nextEpisode?.number || ''}`.trim(),
                }
              : null,
          }}
        />
      }
    />
  );
}
