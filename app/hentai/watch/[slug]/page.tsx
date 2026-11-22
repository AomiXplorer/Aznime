import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EpisodeList } from '@/components/EpisodeList';
import { NekopoiPlayer, type NekopoiNavLink } from '@/components/NekopoiPlayer';
import { WatchLayout, type WatchMetaItem } from '@/components/WatchLayout';
import { ErrorState } from '@/components/ErrorState';
import {
  getNekopoiDetail,
  getNekopoiEpisode,
  nekopoiCleanTitle,
  nekopoiDetailTitle,
  nekopoiDownloadsToBoxes,
  nekopoiEpisodeNumber,
  nekopoiEpisodeSlugFromRoute,
  nekopoiSeriesSlugFromEpisode,
  nekopoiStreamsToMirrors,
  nekopoiToEpisodeSummary,
  type NekopoiDetailPayload,
  type NekopoiEpisodePayload,
} from '@/lib/nekopoi';
import { UpstreamError } from '@/lib/scraper';
import type { EpisodeSummary } from '@/lib/scraper/types';

export const revalidate = 900;

interface HentaiWatchPageProps {
  params: Promise<{ slug: string }>;
}

function episodeValue(episode: EpisodeSummary): number {
  const parsed = Number.parseFloat(episode.number || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNavLink(episode: EpisodeSummary | null, direction: 'prev' | 'next'): NekopoiNavLink | null {
  if (!episode?.slug) return null;
  const label = episode.number
    ? `${direction === 'prev' ? 'Episode sebelumnya' : 'Episode berikutnya'} · Ep ${episode.number}`
    : episode.title;
  return { href: `/hentai/watch/${encodeURIComponent(episode.slug)}`, label };
}

function episodeMeta(number: string | null): WatchMetaItem[] {
  return [
    number ? { label: `Episode ${number}` } : null,
    { label: 'Sub Indo' },
    { label: 'Hentai', dot: 'bg-rose-400' },
  ].filter(Boolean) as WatchMetaItem[];
}

export async function generateMetadata({ params }: HentaiWatchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const inner = nekopoiEpisodeSlugFromRoute(slug);
  if (!inner) return { title: 'Hentai' };

  try {
    const episode = await getNekopoiEpisode(inner);
    const title = nekopoiCleanTitle(episode.title);
    return {
      title,
      description: `Nonton ${title} subtitle Indonesia di Aznime. Khusus penonton 18 tahun ke atas.`,
      alternates: { canonical: `/hentai/watch/${encodeURIComponent(inner)}` },
    };
  } catch {
    return { title: 'Hentai' };
  }
}

export default async function HentaiWatchPage({ params }: HentaiWatchPageProps) {
  const { slug } = await params;
  const inner = nekopoiEpisodeSlugFromRoute(slug);
  if (!inner) notFound();

  let episode: NekopoiEpisodePayload;
  try {
    episode = await getNekopoiEpisode(inner);
  } catch (err) {
    if (err instanceof UpstreamError && err.isNotFound) notFound();
    const message = err instanceof Error ? err.message : 'Gagal memuat episode dari Nekopoi.';
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState title="Gagal memuat pemutar episode" message={message} />
      </div>
    );
  }

  if (!episode.title) notFound();

  // Seri induk hanya bisa ditebak dari slug episode. Kalau tidak berpola seri,
  // halaman tetap tampil tanpa daftar episode lain.
  const seriesSlug = nekopoiSeriesSlugFromEpisode(inner);
  const seriesDetail: NekopoiDetailPayload | null = seriesSlug
    ? await getNekopoiDetail(seriesSlug).catch(() => null)
    : null;

  const summaries = (seriesDetail?.episodes || [])
    .map(nekopoiToEpisodeSummary)
    .sort((a, b) => episodeValue(a) - episodeValue(b));

  const currentSlug = inner;
  const currentIdx = summaries.findIndex((item) => item.slug === currentSlug);
  const older = currentIdx > 0 ? summaries[currentIdx - 1] : null;
  const newer = currentIdx >= 0 && currentIdx < summaries.length - 1 ? summaries[currentIdx + 1] : null;

  const title = nekopoiCleanTitle(episode.title);
  const seriesTitle = seriesDetail ? nekopoiDetailTitle(seriesDetail.title) : null;
  const seriesHref = seriesSlug ? `/hentai/${encodeURIComponent(seriesSlug)}` : null;

  return (
    <WatchLayout
      seriesTitle={seriesTitle || title}
      seriesHref={seriesHref}
      title={title}
      meta={episodeMeta(nekopoiEpisodeNumber(episode.title))}
      downloadBoxes={nekopoiDownloadsToBoxes(episode.downloads)}
      downloadHeading="Unduh episode"
      episodeCount={summaries.length}
      episodesSlot={
        summaries.length > 0 ? (
          <EpisodeList episodes={summaries} currentSlug={currentSlug} hrefBase="/hentai/watch" />
        ) : null
      }
      player={
        <NekopoiPlayer
          key={inner}
          title={title}
          servers={nekopoiStreamsToMirrors(episode.streams)}
          navigation={{ prev: toNavLink(older, 'prev'), next: toNavLink(newer, 'next') }}
          seriesHref={seriesHref}
          seriesTitle={seriesTitle}
        />
      }
    />
  );
}
