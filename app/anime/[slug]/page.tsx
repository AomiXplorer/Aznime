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

async function buildMalzDetail(id: string): Promise<AnimeDetailView> {
  const [detail, firstPage] = await Promise.all([
    getMalzDetail(id),
    getMalzEpisodes(id, 0),
  ]);
  const anime = detail.anime;

  const episodeSummaries = firstPage.items.map(malzToEpisodeSummary);
  const startEpisode = detail.episode_terakhir
    ? malzToEpisodeSummary(detail.episode_terakhir)
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
      '@id': `${absoluteUrl(`/anime/${encodeURIComponent(malzAnimeSlug(id))}`)}#tvseries`,
      name: anime.judul,
      alternateName: altTitle || undefined,
      description: anime.sinopsis || undefined,
      image: card.poster ? absoluteUrl(card.poster) : undefined,
      url: absoluteUrl(`/anime/${encodeURIComponent(malzAnimeSlug(id))}`),
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

export async function generateMetadata({ params }: AnimeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const malzId = malzAnimeIdFromSlug(decodedSlug);

  if (malzId) {
    try {
      const detail = await getMalzDetail(malzId);
      const anime = detail.anime;
      const description = anime.sinopsis
        ? anime.sinopsis.slice(0, 155).trim()
        : `Tonton ${anime.judul} subtitle Indonesia lengkap di Aznime.`;
      const image = malzToCard(anime).poster;

      return {
        title: anime.judul,
        description,
        alternates: { canonical: `/anime/${encodeURIComponent(decodedSlug)}` },
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

export default async function AnimeDetailPage({ params }: AnimeDetailPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const malzId = malzAnimeIdFromSlug(decodedSlug);

  if (malzId) {
    return (
      <Suspense
        fallback={
          <p role="status" className="mx-auto max-w-7xl px-4 py-12 text-sm text-zinc-400 sm:px-6 lg:px-8">
            Memuat detail anime…
          </p>
        }
      >
        <MalzAnimeDetail id={malzId} slug={decodedSlug} />
      </Suspense>
    );
  }

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

  const view = await buildHidoriDetail(detail);
  return (
    <AnimeDetailLayout
      {...view}
      favoriteSlot={<FavoriteButton animeId={decodedSlug} title={view.title} poster={view.poster} />}
    />
  );
}
