import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDetail, UpstreamError } from '@/lib/scraper';
import {
  getMalzDetail,
  getMalzEpisodes,
  getMalzSearch,
  malzAnimeIdFromSlug,
  malzAnimeSlug,
  resolveMalzAnimeId,
  malzSinonimList,
  malzStatusLabel,
  malzToCard,
  malzToEpisodeSummary,
  malzTypeLabel,
} from '@/lib/malz';
import { normalizeTitle } from '@/lib/sources';
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

async function HidoriEpisodeCatalog({ detail }: { detail: AnimeDetail }) {
  const firstAvailable = Math.min(
    ...detail.episodes
      .map((episode) => episodeNumberValue(episode))
      .filter((number) => number > 0)
  );
  if (!Number.isFinite(firstAvailable) || firstAvailable <= 1) {
    return <EpisodeList episodes={detail.episodes} />;
  }

  try {
    const archiveQuery = normalizeTitle(detail.title);
    const archive = (await getMalzSearch(archiveQuery, 0, 'title')).find(
      (item) => normalizeTitle(item.judul) === normalizeTitle(detail.title)
    );
    if (!archive) return <EpisodeList episodes={detail.episodes} />;

    const [archiveDetail, firstPage] = await Promise.all([
      getMalzDetail(archive.id),
      getMalzEpisodes(archive.id, 0),
    ]);
    const episodes = firstPage.items.map(malzToEpisodeSummary);
    const totalCount = Math.max(
      episodeNumberValue(
        archiveDetail.episode_terakhir
          ? malzToEpisodeSummary(archiveDetail.episode_terakhir)
          : undefined
      ),
      ...episodes.map(episodeNumberValue)
    );

    return (
      <div>
        <p className="pb-2 text-[11.5px] text-zinc-400">
          Episode lama tersedia melalui arsip.
        </p>
        <MalzEpisodeList
          animeId={archive.id}
          initialEpisodes={episodes}
          initialPage={0}
          perPage={firstPage.perHalaman}
          totalCount={totalCount}
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
    return (
      <div>
        <p role="alert" className="pb-2 text-[11.5px] text-rose-400">
          Episode arsip gagal dimuat: {message}
        </p>
        <EpisodeList episodes={detail.episodes} />
      </div>
    );
  }
}

  const episodeSummaries = episodes.map((episode) => malzToEpisodeSummary(episode, anime.judul));
  const startEpisode = detail.episode_terakhir
    ? malzToEpisodeSummary(detail.episode_terakhir, anime.judul)
    : episodeSummaries[episodeSummaries.length - 1] || null;
  const latestEpisode = episodeSummaries[0] || startEpisode;
  const highestNumber = episodeSummaries.reduce(
    (highest, episode) => Math.max(highest, episodeNumberValue(episode)),
    episodeNumberValue(startEpisode || undefined)
  );
  const card = malzToCard(anime);
  const altTitle = malzSinonimList(anime).join(', ') || null;
  const recommendations = (detail.season || [])
    .map(malzToCard)
    .filter((card) => card.slug !== `malz-${id}`);

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
    totalEpisodes: highestNumber,
    startEpisode,
    latestEpisode,
    trailer: null,
    banner: null,
    deferTrailer: true,
    downloadBoxes: [],
    recommendations,
    filterKnownRecommendations: true,
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
        initialPage={0}
        perPage={firstPage.perHalaman}
        totalCount={highestNumber}
      />
    ),
  };
}

async function MalzAnimeDetail({ id, slug }: { id: string; slug: string }) {
  try {
    const view = await buildMalzDetail(id);
    return (
      <AnimeDetailLayout
        {...view}
        favoriteSlot={
          <FavoriteButton animeId={slug} title={view.title} poster={view.poster} />
        }
      />
    );
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

async function buildHidoriDetail(detail: AnimeDetail): Promise<AnimeDetailView> {
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
    totalEpisodes: Math.max(
      detail.totalEpisodes || 0,
      ...detail.episodes.map(episodeNumberValue)
    ),
    startEpisode: firstEpisode,
    latestEpisode,
    trailer: null,
    banner: null,
    deferTrailer: true,
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
    episodesSlot: (
      <Suspense
        fallback={
          <p role="status" className="py-5 text-[12.5px] text-zinc-400">
            Memuat daftar episode…
          </p>
        }
      >
        <HidoriEpisodeCatalog detail={detail} />
      </Suspense>
    ),
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
