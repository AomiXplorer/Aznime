import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDetail, getEpisode, UpstreamError } from '@/lib/scraper';
import type { EpisodeNavLink, EpisodeSummary } from '@/lib/scraper/types';
import { cleanEpisodeTitle, episodeNumberFromTitle } from '@/lib/episode-format';
import {
  getMalzDetail,
  getMalzEpisodes,
  getMalzStream,
  malzAnimeSlug,
  malzEpisodeIdFromSlug,
  malzImageUrl,
  malzEpisodeSlug,
  malzServersToMirrors,
  malzStatusLabel,
  malzToCard,
  malzToEpisodeSummary,
  type MalzEpisode,
} from '@/lib/malz';
import { VideoPlayer } from '@/components/VideoPlayer';
import { EpisodeList } from '@/components/EpisodeList';
import { MalzEpisodeList } from '@/components/MalzEpisodeList';
import { WatchLayout, type WatchMetaItem } from '@/components/WatchLayout';
import { ErrorState } from '@/components/ErrorState';
import { getSessionUser } from '@/lib/auth/session';
import { isEpisodeLocked } from '@/lib/auth/episode-policy';
import { AuthGate } from '@/components/auth/AuthGate';
import { WatchRecorder } from '@/components/history/WatchRecorder';
import { posterUrlWithTitleFallback } from '@/lib/posters';

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

function malzNavLink(episode: MalzEpisode | null): EpisodeNavLink | null {
  if (!episode) return null;
  const summary = malzToEpisodeSummary(episode);
  return {
    title: summary.title,
    slug: summary.slug,
    url: summary.url,
    number: summary.number,
  };
}

function episodeMeta(number: string | null, extra: string | null, status: string | null): WatchMetaItem[] {
  const items: WatchMetaItem[] = [
    number ? { label: /^\d/.test(number) ? `Episode ${number}` : number } : null,
    extra ? { label: extra } : null,
    { label: 'Sub Indo' },
    status
      ? { label: status, dot: status === 'Sedang tayang' ? 'bg-emerald-400' : 'bg-zinc-500' }
      : null,
  ].filter(Boolean) as WatchMetaItem[];
  return items;
}

interface MalzWatchData {
  animeId: string;
  seriesSlug: string;
  title: string;
  seriesTitle: string;
  seriesHref: string;
  episodeNumber: string | null;
  year: string | null;
  status: string | null;
  servers: ReturnType<typeof malzServersToMirrors>;
  defaultEmbed: string | null;
  navigation: {
    prev: EpisodeNavLink | null;
    all: EpisodeNavLink | null;
    next: EpisodeNavLink | null;
  };
  episodes: EpisodeSummary[];
  loadedPage: number;
  perPage: number;
  totalEpisodes: number;
  minAvailableEpisode: number | null;
  poster: string | null;
  episodePoster: string | null;
}

async function buildMalzWatch(episodeId: string): Promise<MalzWatchData> {
  const stream = await getMalzStream(episodeId);
  if (!stream.episode) {
    throw new UpstreamError('Episode tidak ditemukan di arsip Malz', { status: 404 });
  }

  const episode = stream.episode;
  const animeId = episode.id_anime;
  const [detail, firstPage] = await Promise.all([
    getMalzDetail(animeId).catch(() => null),
    getMalzEpisodes(animeId, 0),
  ]);

  const perHalaman = firstPage.perHalaman;
  const maxNumber = Number.parseFloat(firstPage.items[0]?.episode || '') || 0;
  const targetNumber = Number.parseFloat(episode.episode || '') || 0;

  // Halaman episode dihitung dari nomor episode supaya seri panjang tidak perlu
  // diambil halaman demi halaman hanya untuk menemukan episode yang dibuka.
  const targetPage =
    maxNumber > 0 && targetNumber > 0 && maxNumber >= targetNumber
      ? Math.max(0, Math.floor((maxNumber - targetNumber) / perHalaman))
      : 0;

  const [pageA, pageB] = await Promise.all([
    targetPage === 0 ? Promise.resolve(firstPage) : getMalzEpisodes(animeId, targetPage).catch(() => firstPage),
    getMalzEpisodes(animeId, targetPage + 1).catch(() => null),
  ]);

  const episodeById = new Map<string, MalzEpisode>();
  for (const item of [...pageA.items, ...(pageB?.items || [])]) episodeById.set(item.id, item);
  const episodes = [...episodeById.values()].sort(
    (a, b) => (Number.parseFloat(b.episode) || 0) - (Number.parseFloat(a.episode) || 0)
  );
  const loadedPage = targetPage + 1;

  const currentIndex = episodes.findIndex((item) => item.id === episodeId);
  const olderEpisode = currentIndex >= 0 ? episodes[currentIndex + 1] || null : null;
  const newerEpisode = currentIndex >= 0 ? episodes[currentIndex - 1] || null : null;

  const summaries = episodes.map(malzToEpisodeSummary);
  const seriesSlug = malzAnimeSlug(animeId);
  const allLink: EpisodeNavLink = {
    title: detail?.anime.judul || 'Semua episode',
    slug: seriesSlug,
    url: '',
  };

  const totalEpisodes = summaries.reduce((max, item) => {
    const value = Number.parseFloat(item.number || '');
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  const highestEpisode = Math.max(
    totalEpisodes,
    ...firstPage.items.map((item) => Number.parseFloat(item.episode) || 0)
  );
  const servers = malzServersToMirrors(stream.servers);
  const firstDirect = servers.find((server) => server.type === 'video' || server.type === 'hls');
  const posterTitle = cleanEpisodeTitle(detail?.anime.judul || 'Anime');
  const seriesPoster = detail ? malzToCard(detail.anime).poster : null;

  return {
    animeId,
    seriesSlug,
    title: cleanEpisodeTitle(episode.judul || `Episode ${episode.episode}`),
    seriesTitle: cleanEpisodeTitle(detail?.anime.judul || 'Detail seri'),
    seriesHref: `/anime/${encodeURIComponent(seriesSlug)}`,
    episodeNumber: episode.episode || null,
    year: detail?.anime.tahun || null,
    status: detail?.anime.status ? malzStatusLabel(detail.anime.status) : null,
    servers,
    defaultEmbed: firstDirect?.url || null,
    navigation: {
      prev: malzNavLink(olderEpisode),
      all: allLink,
      next: malzNavLink(newerEpisode) || malzNavLink(stream.berikutnya),
    },
    episodes: summaries,
    loadedPage,
    perPage: perHalaman,
    poster: seriesPoster,
    totalEpisodes: highestEpisode || summaries.length,
    minAvailableEpisode: null,
    episodePoster:
      (episode.gambar
        ? posterUrlWithTitleFallback(episode.gambar, posterTitle, null, 640)
        : null) || seriesPoster,
  };
}

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const malzEpisodeId = malzEpisodeIdFromSlug(decodedSlug);

  if (malzEpisodeId) {
    try {
      const stream = await getMalzStream(malzEpisodeId);
      const episode = stream.episode;
      if (!episode) return { title: 'Nonton anime' };
      const label = cleanEpisodeTitle(episode.judul || `Episode ${episode.episode}`);

      /* Judul episode dari arsip sering cuma "Episode 2", jadi puluhan halaman
         berbeda akan punya judul identik. Nama seri ditempel di depan supaya
         setiap halaman punya judul unik; detail seri sudah di-cache 900 detik
         dan dipakai juga saat merender halaman, jadi tidak menambah beban. */
      const seriesTitle = episode.id_anime
        ? await getMalzDetail(episode.id_anime)
            .then((detail) => cleanEpisodeTitle(detail.anime.judul))
            .catch(() => null)
        : null;

      const generic = /^episode\b/i.test(label);
      const uniqueLabel =
        seriesTitle && !label.toLowerCase().includes(seriesTitle.toLowerCase())
          ? `${seriesTitle} ${generic ? label : `Episode ${episode.episode}`}`
          : label;

      return {
        title: uniqueLabel,
        description: `Nonton streaming ${uniqueLabel} subtitle Indonesia di Aznime. Pilih kualitas video yang tersedia.`,
        alternates: { canonical: `/watch/${encodeURIComponent(decodedSlug)}` },
      };
    } catch {
      return { title: 'Nonton anime' };
    }
  }

  try {
    const ep = await getEpisode(decodedSlug);
    if (!ep.title) return { title: 'Nonton anime' };
    return {
      title: ep.title,
      description: `Nonton streaming ${ep.title} subtitle Indonesia di Aznime. Pilih server yang tersedia dan tautan unduhan per resolusi.`,
      alternates: { canonical: `/watch/${encodeURIComponent(decodedSlug)}` },
    };
  } catch {
    return { title: 'Nonton anime' };
  }
}

async function MalzWatchPage({ episodeId }: { episodeId: string }) {
  let data: MalzWatchData;
  try {
    data = await buildMalzWatch(episodeId);
  } catch (err) {
    if (err instanceof UpstreamError && err.isNotFound) notFound();
    const message = err instanceof Error ? err.message : 'Gagal memuat episode dari arsip.';
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState title="Gagal memuat pemutar episode" message={message} />
      </div>
    );
  }

  const user = await getSessionUser();
  const locked = isEpisodeLocked(data.episodeNumber, Boolean(user));
  const episodeSlug = malzEpisodeSlug(episodeId);

  return (
    <WatchLayout
      seriesTitle={data.seriesTitle}
      seriesHref={data.seriesHref}
      breadcrumbPath={`/watch/${encodeURIComponent(episodeSlug)}`}
      title={data.title}
      meta={episodeMeta(data.episodeNumber, data.year, data.status)}
      downloadBoxes={[]}
      downloadHeading="Unduh episode"
      episodeCount={data.totalEpisodes}
      episodesSlot={
        data.episodes.length > 0 ? (
          <MalzEpisodeList
            animeId={data.animeId}
            initialEpisodes={data.episodes}
            initialPage={data.loadedPage}
            perPage={data.perPage}
            currentSlug={malzEpisodeSlug(episodeId)}
            totalCount={data.totalEpisodes}
            minAvailableEpisode={data.minAvailableEpisode}
          />
        ) : null
      }
      player={
        locked ? (
          <AuthGate
            seriesTitle={data.seriesTitle}
            episodeNumber={data.episodeNumber}
            returnTo={`/watch/${encodeURIComponent(episodeSlug)}`}
          />
        ) : (
          <>
            <WatchRecorder
              animeId={data.seriesSlug}
              title={data.seriesTitle}
              poster={data.poster}
              episodeNumber={data.episodeNumber}
              episodeSlug={episodeSlug}
              episodeTitle={data.title}
            />
            <VideoPlayer
              key={episodeId}
              title={data.title}
              servers={data.servers}
              defaultEmbed={data.defaultEmbed}
              episodes={data.episodes.map((item) => ({
                title: item.title,
                slug: item.slug,
                url: item.url,
                number: item.number,
              }))}
              navigation={data.navigation}
              seriesSlug={data.seriesSlug}
              seriesTitle={data.seriesTitle}
              poster={data.episodePoster}
              totalEpisodes={data.totalEpisodes}
              malzSearch={{ animeId: data.animeId, perPage: data.perPage }}
            />
          </>
        )
      }
    />
  );
}

export default async function WatchEpisodePage({ params }: WatchPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const malzEpisodeId = malzEpisodeIdFromSlug(decodedSlug);

  if (malzEpisodeId) {
    return <MalzWatchPage episodeId={malzEpisodeId} />;
  }

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
  const currentIdx = episodes.findIndex((ep) => ep.slug === decodedSlug || ep.url === episode.url);
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
  const user = await getSessionUser();
  const locked = isEpisodeLocked(episodeNumber, Boolean(user));

  return (
    <WatchLayout
      seriesTitle={seriesTitle}
      seriesHref={seriesSlug ? `/anime/${encodeURIComponent(seriesSlug)}` : null}
      breadcrumbPath={`/watch/${encodeURIComponent(decodedSlug)}`}
      title={cleanTitle}
      meta={episodeMeta(episodeNumber, season, status)}
      downloadBoxes={locked ? [] : episode.downloads}
      downloadHeading="Unduh episode"
      episodeCount={seriesDetail?.totalEpisodes ?? episodes.length}
      episodesSlot={
        seriesDetail && seriesDetail.episodes.length > 0 ? (
          <EpisodeList episodes={seriesDetail.episodes} currentSlug={decodedSlug} />
        ) : null
      }
      player={
        locked ? (
          <AuthGate
            seriesTitle={seriesTitle}
            episodeNumber={episodeNumber}
            returnTo={`/watch/${encodeURIComponent(decodedSlug)}`}
          />
        ) : (
          <>
            <WatchRecorder
              animeId={seriesSlug || decodedSlug}
              title={seriesTitle}
              poster={seriesDetail?.poster || null}
              episodeNumber={episodeNumber}
              episodeSlug={decodedSlug}
              episodeTitle={cleanTitle}
            />
            <VideoPlayer
              key={decodedSlug}
              title={cleanTitle}
              servers={episode.servers}
              defaultEmbed={episode.defaultEmbed}
              episodes={episodes.map((item) => ({
                title: item.title,
                slug: item.slug,
                url: item.url,
                number: item.number,
              }))}
              navigation={navigation}
              seriesSlug={seriesSlug}
              seriesTitle={seriesTitle}
              poster={seriesDetail?.poster || null}
            />
          </>
        )
      }
    />
  );
}
