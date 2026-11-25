import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDetail, UpstreamError } from '@/lib/scraper';
import { getAniListTrailer } from '@/lib/anilist';
import { getHidoriTitleIndex, isKnownTitle } from '@/lib/sources';
import {
  getMalzDetail,
  getMalzEpisodes,
  malzAnimeIdFromSlug,
  malzAnimeSlug,
  resolveMalzAnimeId,
  malzSinonimList,
  malzStatusLabel,
  malzToCard,
  malzToEpisodeSummary,
  malzTypeLabel,
} from '@/lib/malz';
import type { AnimeDetail, EpisodeSummary } from '@/lib/scraper/types';
import { AnimeDetailLayout, type AnimeDetailView } from '@/components/AnimeDetailLayout';
import { EpisodeList } from '@/components/EpisodeList';
import { MalzEpisodeList } from '@/components/MalzEpisodeList';
import { ErrorState } from '@/components/ErrorState';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { absoluteUrl } from '@/lib/site';
import { organizationId } from '@/lib/seo';

export const revalidate = 300;

interface AnimeDetailPageProps {
  params: Promise<{ slug: string }>;
}

function episodeNumberValue(episode: EpisodeSummary | undefined): number {
  const raw = episode?.number;
  if (!raw) return 0;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function buildMalzDetail(id: string): Promise<AnimeDetailView> {
  const detail = await getMalzDetail(id);
  const anime = detail.anime;

  const firstPage = await getMalzEpisodes(id, 0);
  let episodes = firstPage.items;
  let loadedPage = 0;

  if (firstPage.items.length >= firstPage.perHalaman) {
    const secondPage = await getMalzEpisodes(id, 1).catch(() => null);
    if (secondPage && secondPage.items.length > 0) {
      episodes = [...firstPage.items, ...secondPage.items];
      loadedPage = 1;
    }
  }

  const episodeSummaries = episodes.map((episode) => malzToEpisodeSummary(episode, anime.judul));
  const startEpisode = detail.episode_terakhir
    ? malzToEpisodeSummary(detail.episode_terakhir, anime.judul)
    : episodeSummaries[episodeSummaries.length - 1] || null;
  const latestEpisode = episodeSummaries[0] || null;
  const highestNumber = episodeSummaries.reduce(
    (max, episode) => Math.max(max, episodeNumberValue(episode)),
    0
  );

  const card = malzToCard(anime);
  const altTitle = malzSinonimList(anime).join(', ') || null;
  const trailer = await getAniListTrailer(anime.judul, altTitle).catch(() => null);

  const hidoriIndex = await getHidoriTitleIndex();
  const recommendations = (detail.season || [])
    .map(malzToCard)
    .filter((card) => card.slug !== `malz-${id}` && !isKnownTitle(card, hidoriIndex));

  const info: Record<string, string> = {
    Status: anime.status ? malzStatusLabel(anime.status) : '',
    Tipe: anime.tipe ? malzTypeLabel(anime.tipe) : '',
    Tahun: anime.tahun || '',
    Studio: anime.studio || '',
    'Hari tayang': anime.hari && anime.hari !== 'RANDOM' ? anime.hari : '',
    'Mulai tayang': anime.tayang || '',
    Selesai: anime.selesai || '',
    Views: anime.views ? Number(anime.views).toLocaleString('id-ID') : '',
  };

  return {
    title: anime.judul,
    altTitle,
    poster: card.poster,
    posterUnoptimized: true,
    rating: anime.rating ? anime.rating : null,
    synopsis: anime.sinopsis || null,
    info,
    genres: (detail.genre || []).map((genre) => ({ name: genre.nama, slug: null })),
    totalEpisodes: highestNumber || episodeSummaries.length,
    startEpisode,
    latestEpisode,
    trailer,
    banner: trailer?.bannerImage || null,
    downloadBoxes: [],
    recommendations,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      '@id': `${absoluteUrl(`/anime/${encodeURIComponent(malzAnimeSlug(id, anime.judul))}`)}#tvseries`,
      name: anime.judul,
      alternateName: altTitle || undefined,
      description: anime.sinopsis || undefined,
      image: card.poster ? absoluteUrl(card.poster) : undefined,
      url: absoluteUrl(`/anime/${encodeURIComponent(malzAnimeSlug(id, anime.judul))}`),
      inLanguage: 'id-ID',
      genre: (detail.genre || []).map((genre) => genre.nama),
      numberOfEpisodes: highestNumber || undefined,
      publisher: { '@id': organizationId() },
    },
    episodesSlot: (
      <MalzEpisodeList
        animeId={id}
        initialEpisodes={episodeSummaries}
        initialPage={loadedPage}
        perPage={firstPage.perHalaman}
      />
    ),
  };
}

async function buildHidoriDetail(detail: AnimeDetail): Promise<AnimeDetailView> {
  const trailer = await getAniListTrailer(detail.title, detail.altTitle).catch(() => null);

  const firstEpisode = detail.episodes.length > 0 ? detail.episodes[detail.episodes.length - 1] : null;
  const latestEpisode = detail.episodes.length > 0 ? detail.episodes[0] : null;

  return {
    title: detail.title,
    altTitle: detail.altTitle,
    poster: detail.poster,
    rating: detail.rating,
    synopsis: detail.synopsis,
    info: detail.info,
    genres: detail.genres.map((genre) => ({ name: genre.name, slug: genre.slug })),
    totalEpisodes: detail.totalEpisodes,
    startEpisode: firstEpisode,
    latestEpisode,
    trailer,
    banner: trailer?.bannerImage || null,
    downloadBoxes: detail.batchDownloads,
    recommendations: detail.recommendations,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      '@id': detail.slug
        ? `${absoluteUrl(`/anime/${encodeURIComponent(detail.slug)}`)}#tvseries`
        : undefined,
      name: detail.title,
      alternateName: detail.altTitle || undefined,
      description: detail.synopsis || undefined,
      image: detail.poster ? absoluteUrl(detail.poster) : undefined,
      url: detail.slug ? absoluteUrl(`/anime/${encodeURIComponent(detail.slug)}`) : undefined,
      inLanguage: 'id-ID',
      genre: detail.genres.map((genre) => genre.name),
      numberOfEpisodes: detail.totalEpisodes || undefined,
      publisher: { '@id': organizationId() },
    },
    episodesSlot: <EpisodeList episodes={detail.episodes} />,
  };
}

async function malzMetadata(id: string): Promise<Metadata> {
  try {
    const detail = await getMalzDetail(id);
    const anime = detail.anime;
    const description = anime.sinopsis
      ? anime.sinopsis.slice(0, 155).trim()
      : `Tonton ${anime.judul} subtitle Indonesia lengkap di Aznime.`;
    const trailer = await getAniListTrailer(anime.judul, malzSinonimList(anime).join(', ')).catch(
      () => null
    );
    const image = trailer?.bannerImage || malzToCard(anime).poster;
    const canonical = `/anime/${encodeURIComponent(malzAnimeSlug(anime.id, anime.judul))}`;

    return {
      title: anime.judul,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'video.tv_show',
        title: `${anime.judul} | Aznime`,
        description,
        images: image ? [{ url: image, alt: anime.judul }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${anime.judul} | Aznime`,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return { title: 'Detail anime' };
  }
}

export async function generateMetadata({ params }: AnimeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const malzId = malzAnimeIdFromSlug(decodedSlug);

  if (malzId) return malzMetadata(malzId);

  if (!/-subtitle-indonesia$/i.test(decodedSlug)) {
    const readableMalzId = await resolveMalzAnimeId(decodedSlug);
    if (readableMalzId) return malzMetadata(readableMalzId);
  }

  try {
    const detail = await getDetail(decodedSlug);
    if (!detail.title) {
      const readableMalzId = await resolveMalzAnimeId(decodedSlug);
      return readableMalzId ? malzMetadata(readableMalzId) : { title: 'Anime tidak ditemukan' };
    }

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
    const readableMalzId = await resolveMalzAnimeId(decodedSlug);
    return readableMalzId ? malzMetadata(readableMalzId) : { title: 'Detail anime' };
  }
}

export default async function AnimeDetailPage({ params }: AnimeDetailPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const malzId = malzAnimeIdFromSlug(decodedSlug);

  const renderMalz = async (id: string) => {
    const view = await buildMalzDetail(id);
    return (
      <AnimeDetailLayout
        {...view}
        favoriteSlot={<FavoriteButton animeId={decodedSlug} title={view.title} poster={view.poster} />}
      />
    );
  };

  if (malzId) {
    try {
      return await renderMalz(malzId);
    } catch (err) {
      if (err instanceof UpstreamError && err.isNotFound) notFound();
      const message = err instanceof Error ? err.message : 'Gagal memuat detail anime dari arsip.';
      return (
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <ErrorState title="Gagal memuat detail anime" message={message} />
        </div>
      );
    }
  }

  if (!/-subtitle-indonesia$/i.test(decodedSlug)) {
    const readableMalzId = await resolveMalzAnimeId(decodedSlug);
    if (readableMalzId) return await renderMalz(readableMalzId);
  }

  let detail = null;
  let upstreamError: string | null = null;
  try {
    detail = await getDetail(decodedSlug);
  } catch (err) {
    if (err instanceof UpstreamError && err.isNotFound) {
      const readableMalzId = await resolveMalzAnimeId(decodedSlug);
      if (readableMalzId) {
        try {
          return await renderMalz(readableMalzId);
        } catch (malzErr) {
          if (malzErr instanceof UpstreamError && malzErr.isNotFound) notFound();
          const message =
            malzErr instanceof Error ? malzErr.message : 'Gagal memuat detail anime dari arsip.';
          return (
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
              <ErrorState title="Gagal memuat detail anime" message={message} />
            </div>
          );
        }
      }
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
    const readableMalzId = await resolveMalzAnimeId(decodedSlug);
    if (readableMalzId) return await renderMalz(readableMalzId);
    notFound();
  }

  const view = await buildHidoriDetail(detail);
  return (
    <AnimeDetailLayout
      {...view}
      favoriteSlot={<FavoriteButton animeId={decodedSlug} title={view.title} poster={view.poster} />}
    />
  );
}
