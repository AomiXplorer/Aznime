import Link from 'next/link';
import { getHome, getOngoing } from '@/lib/scraper';
import { withoutAdult } from '@/lib/adult';
import type { FeaturedAnime } from '@/lib/scraper';
import { getAniListTrailer } from '@/lib/anilist';
import {
  archiveByStatus,
  getMalzArchivePool,
  mergeAnimeCards,
  getHidoriTitleIndex,
  getMalzPopularRanking,
  topUpPopularRanking,
} from '@/lib/sources';
import { HeroSection } from '@/components/HeroSection';
import { PopularRanking } from '@/components/PopularRanking';
import { AnimeRow } from '@/components/AnimeRow';
import { AnimeGrid } from '@/components/AnimeGrid';
import { ComicRow } from '@/components/comics/ComicRow';
import { getKomikFeed, getWebtoonFeed } from '@/lib/comics';
import { ErrorState } from '@/components/ErrorState';

export const revalidate = 180;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function HomePage() {
  const [homeRes, ongoingRes, poolRes, indexRes] = await Promise.allSettled([
    getHome(1),
    getOngoing(1),
    getMalzArchivePool(),
    getHidoriTitleIndex(),
  ]);

  if (homeRes.status === 'rejected') {
    const message =
      homeRes.reason instanceof Error ? homeRes.reason.message : 'Gagal memuat beranda dari server sumber.';
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <ErrorState title="Beranda tidak bisa dimuat" message={message} />
      </div>
    );
  }

  const home = homeRes.value;
  const ongoing = ongoingRes.status === 'fulfilled' ? ongoingRes.value.results : [];
  const archive = poolRes.status === 'fulfilled' ? poolRes.value : [];
  const hidoriIndex = indexRes.status === 'fulfilled' ? indexRes.value : new Set<string>();

  const heroItems = await Promise.all(
    withoutAdult(home.featured)
      .slice(0, 6)
      .map(async (f: FeaturedAnime) => ({
        ...f,
        trailer: await withTimeout(getAniListTrailer(f.title).catch(() => null), 1200, null),
      }))
  );

  /* Sumber utama peringkat: arsip Malz (views + favorit). Daftar populer
     Hidori hanya dipakai kalau Malz sedang tidak bisa dihubungi, supaya
     bagian ini tidak pernah kosong. */
  const [komikFeed, webtoonFeed] = await Promise.all([
    getKomikFeed(14),
    getWebtoonFeed(14),
  ]);

  const malzRanking = await getMalzPopularRanking(5).catch(() => null);
  const popular =
    malzRanking && malzRanking.trending.length > 0
      ? malzRanking
      : await Promise.all([
          topUpPopularRanking(home.popular.weekly).then(withoutAdult),
          topUpPopularRanking(home.popular.monthly).then(withoutAdult),
          topUpPopularRanking(home.popular.alltime).then(withoutAdult),
        ]).then(([weekly, monthly, alltime]) => ({
          trending: weekly,
          favorite: monthly,
          mostViewed: alltime,
        }));

  const ongoingWithArchive = withoutAdult(
    mergeAnimeCards(ongoing, archiveByStatus(archive, 'Ongoing', 8), hidoriIndex)
  );
  const archiveRow = withoutAdult(archive).slice(0, 14);
  const latestRelease = withoutAdult(home.latestRelease);
  const completedLatest = withoutAdult(home.completedLatest);

  return (
    <>
      {heroItems.length > 0 ? <HeroSection items={heroItems} /> : null}
      <div className="relative z-10 mx-auto max-w-7xl space-y-12 px-4 pt-8 sm:px-6 lg:px-8">
        <PopularRanking
          trending={withoutAdult(popular.trending)}
          favorite={withoutAdult(popular.favorite)}
          mostViewed={withoutAdult(popular.mostViewed)}
        />
        {/* Tanpa priority: baris ini selalu berada di bawah hero, jadi preload di
            sini hanya bersaing dengan banner yang jadi LCP. */}
        <AnimeRow title="Sedang tayang" items={ongoingWithArchive} viewAllHref="/ongoing" />
        <AnimeRow title="Episode terbaru" items={latestRelease} viewAllHref="/anime?order=update" />
        {archiveRow.length > 0 ? (
          <section aria-label="Dari arsip">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-2.5">
              <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-white">
                Dari arsip
              </h2>
              <Link
                href="/anime"
                className="inline-flex items-center gap-0.5 text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white"
              >
                Semua
              </Link>
            </div>
            <AnimeGrid items={archiveRow} fillRows />
          </section>
        ) : null}
        <AnimeRow title="Baru tamat" items={completedLatest} viewAllHref="/completed" />

        <ComicRow
          title="Webtoon"
          items={webtoonFeed.items}
          viewAllHref="/webtoon"
          aspect="3/4"
        />

        <ComicRow title="Komik" items={komikFeed.items} viewAllHref="/komik" />
      </div>
    </>
  );
}
