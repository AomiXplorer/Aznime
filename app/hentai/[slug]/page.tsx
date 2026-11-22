import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AnimeDetailLayout, type AnimeDetailView } from '@/components/AnimeDetailLayout';
import { EpisodeList } from '@/components/EpisodeList';
import { ErrorState } from '@/components/ErrorState';
import {
  getNekopoiDetail,
  getNekopoiEpisode,
  nekopoiSeriesSlugFromRoute,
  nekopoiDetailGenres,
  nekopoiDetailTitle,
  nekopoiSynopsis,
  nekopoiToEpisodeSummary,
  type NekopoiDetailPayload,
} from '@/lib/nekopoi';
import { UpstreamError } from '@/lib/scraper';
import type { EpisodeSummary } from '@/lib/scraper/types';

export const revalidate = 1800;

interface HentaiDetailPageProps {
  params: Promise<{ slug: string }>;
}

function episodeValue(episode: EpisodeSummary): number {
  const parsed = Number.parseFloat(episode.number || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Episode di sumber urut naik; diurutkan ulang supaya tombol mulai/terbaru benar. */
function sortEpisodes(detail: NekopoiDetailPayload): EpisodeSummary[] {
  return detail.episodes
    .map(nekopoiToEpisodeSummary)
    .sort((a, b) => episodeValue(a) - episodeValue(b));
}

/**
 * Halaman detail Nekopoi tidak memuat sinopsis, sedangkan halaman episodenya
 * memuat. Deskripsi episode terbaru dipakai sebagai sinopsis seri.
 */
async function resolveSynopsis(detail: NekopoiDetailPayload): Promise<string | null> {
  const newest = detail.episodes[detail.episodes.length - 1];
  if (!newest) return null;
  try {
    const episode = await getNekopoiEpisode(newest.slug);
    return nekopoiSynopsis(episode.description);
  } catch {
    return null;
  }
}

function buildView(detail: NekopoiDetailPayload, synopsis: string | null): AnimeDetailView {
  const episodes = sortEpisodes(detail);
  const title = nekopoiDetailTitle(detail.title);
  const genres = nekopoiDetailGenres(detail.genres).map((name) => ({ name, slug: null }));

  return {
    title,
    altTitle: detail.japan_name?.trim() || null,
    poster: detail.thumbnail || null,
    posterUnoptimized: true,
    rating: detail.score?.trim() || null,
    synopsis,
    info: {
      Status: detail.status?.trim() || '',
      Tipe: detail.type?.trim() || '',
      Produser: detail.producer?.trim() || '',
      Durasi: detail.duration?.trim() || '',
    },
    genres,
    totalEpisodes: episodes.length,
    startEpisode: episodes[0] || null,
    latestEpisode: episodes[episodes.length - 1] || null,
    trailer: null,
    banner: null,
    downloadBoxes: [],
    recommendations: [],
    episodeHrefBase: '/hentai/watch',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      name: title,
      alternateName: detail.japan_name || undefined,
      description: synopsis || undefined,
      image: detail.thumbnail || undefined,
      genre: genres.map((genre) => genre.name),
      numberOfEpisodes: episodes.length || undefined,
      contentRating: 'R18+',
    },
    episodesSlot: <EpisodeList episodes={episodes} hrefBase="/hentai/watch" />,
  };
}

export async function generateMetadata({ params }: HentaiDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const inner = nekopoiSeriesSlugFromRoute(slug);
  if (!inner) return { title: 'Hentai' };

  try {
    const detail = await getNekopoiDetail(inner);
    const title = nekopoiDetailTitle(detail.title);
    const description = `Nonton ${title} subtitle Indonesia lengkap di Aznime. Khusus penonton 18 tahun ke atas.`;
    return {
      title,
      description,
      alternates: { canonical: `/hentai/${encodeURIComponent(inner)}` },
    };
  } catch {
    return { title: 'Hentai' };
  }
}

export default async function HentaiDetailPage({ params }: HentaiDetailPageProps) {
  const { slug } = await params;
  const inner = nekopoiSeriesSlugFromRoute(slug);
  if (!inner) notFound();

  let detail: NekopoiDetailPayload;
  try {
    detail = await getNekopoiDetail(inner);
  } catch (err) {
    if (err instanceof UpstreamError && err.isNotFound) notFound();
    const message = err instanceof Error ? err.message : 'Gagal memuat detail dari Nekopoi.';
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState title="Gagal memuat detail hentai" message={message} />
      </div>
    );
  }

  if (!detail.title) notFound();

  const synopsis = await resolveSynopsis(detail);
  return <AnimeDetailLayout {...buildView(detail, synopsis)} />;
}
