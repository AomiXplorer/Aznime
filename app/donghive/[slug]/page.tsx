import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AnimeDetailLayout, type AnimeDetailView } from '@/components/AnimeDetailLayout';
import { EpisodeList } from '@/components/EpisodeList';
import { ErrorState } from '@/components/ErrorState';
import { getDonghiveDetail, donghiveEpisodeSummary } from '@/lib/donghive';
import { UpstreamError } from '@/lib/scraper/utils';

export const revalidate = 1800;

interface DonghiveDetailPageProps {
  params: Promise<{ slug: string }>;
}

function buildView(detail: Awaited<ReturnType<typeof getDonghiveDetail>>): AnimeDetailView {
  const episodes = detail.episodes
    .map(donghiveEpisodeSummary)
    .sort((a, b) => (Number.parseFloat(a.number || '') || 0) - (Number.parseFloat(b.number || '') || 0));
  const info: Record<string, string> = {};
  for (const [key, value] of Object.entries(detail.metadata)) info[key] = value;

  return {
    title: detail.title,
    altTitle: null,
    poster: detail.poster ? `/api/img?u=${encodeURIComponent(detail.poster)}&w=960&q=74&f=webp` : null,
    posterUnoptimized: true,
    rating: detail.rating,
    synopsis: detail.synopsis,
    info,
    genres: detail.genres.map((name) => ({ name, slug: null })),
    totalEpisodes: episodes.length,
    startEpisode: episodes[0] || null,
    latestEpisode: episodes[episodes.length - 1] || null,
    trailer: null,
    deferTrailer: true,
    banner: null,
    downloadBoxes: [],
    recommendations: [],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      name: detail.title,
      description: detail.synopsis || undefined,
      image: detail.poster || undefined,
      genre: detail.genres,
      numberOfEpisodes: episodes.length || undefined,
    },
    episodeHrefBase: '/donghive/watch',
    episodesSlot: <EpisodeList episodes={episodes} hrefBase="/donghive/watch" />,
  };
}

export async function generateMetadata({ params }: DonghiveDetailPageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const detail = await getDonghiveDetail(slug);
    return {
      title: detail.title,
      description: detail.synopsis?.slice(0, 160) || `Nonton ${detail.title} subtitle Indonesia di Aznime.`,
      alternates: { canonical: `/donghive/${encodeURIComponent(detail.slug)}` },
    };
  } catch {
    return { title: 'Donghua' };
  }
}

export default async function DonghiveDetailPage({ params }: DonghiveDetailPageProps) {
  const { slug } = await params;
  try {
    const detail = await getDonghiveDetail(slug);
    return <AnimeDetailLayout {...buildView(detail)} />;
  } catch (error) {
    if (error instanceof UpstreamError && error.isNotFound) notFound();
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState
          title="Gagal memuat detail Donghua"
          message={error instanceof Error ? error.message : 'API Donghua tidak merespons.'}
        />
      </div>
    );
  }
}
