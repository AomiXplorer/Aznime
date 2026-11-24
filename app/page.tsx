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
  topUpPopularRanking,
} from '@/lib/sources';
import { HeroSection } from '@/components/HeroSection';
import { PopularRanking } from '@/components/PopularRanking';
import { AnimeRow } from '@/components/AnimeRow';
import { AnimeGrid } from '@/components/AnimeGrid';
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

<<<<<<< HEAD
  // Trailer AniList hanya memperkaya hero. Batas tunggunya dijaga ketat supaya
  // tidak menahan TTFB/LCP: kalau AniList lambat, hero tetap tampil dengan poster.
  // Beranda bersih dari judul 18+; bagian itu hanya hidup di /hentai.
=======
>>>>>>> c5dfbd0 (Update maintennace)
  const heroItems = await Promise.all(
    withoutAdult(home.featured)
      .slice(0, 6)
      .map(async (f: FeaturedAnime) => ({
        ...f,
        trailer: await withTimeout(getAniListTrailer(f.title).catch(() => null), 1200, null),
      }))
  );

  const [weekly, monthly, alltime] = await Promise.all([
    topUpPopularRanking(home.popular.weekly).then(withoutAdult),
    topUpPopularRanking(home.popular.monthly).then(withoutAdult),
    topUpPopularRanking(home.popular.alltime).then(withoutAdult),
  ]);

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
        <PopularRanking weekly={weekly} monthly={monthly} alltime={alltime} />
<<<<<<< HEAD
        <AnimeRow title="Episode terbaru" items={latestRelease} viewAllHref="/anime?order=update" />
        <AnimeRow title="Sedang tayang" items={ongoingWithArchive} viewAllHref="/ongoing" />
        {/* Pita terang warna tulang: satu-satunya blok terang di halaman, jadi
            mata berhenti di sini sebelum lanjut ke baris berikutnya. */}
        {archiveRow.length > 0 ? (
          <section
            aria-label="Dari arsip"
            className="relative left-1/2 w-screen -translate-x-1/2 border-y border-[#241d1d] bg-bone py-10 text-ink"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-ink/15 pb-2.5">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
                    Dari arsip
                  </h2>
                  <span className="text-[11px] tabular-nums text-[#6f625d]">
                    {archiveRow.length} judul
                  </span>
                </div>
                <Link
                  href="/anime"
                  className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#6f625d] transition-colors duration-150 hover:text-ink"
                >
                  Semua
                </Link>
              </div>
              <AnimeGrid items={archiveRow.slice(0, 14)} tone="light" className="xl:grid-cols-7" />
            </div>
=======
        <AnimeRow title="Episode terbaru" items={latestRelease} viewAllHref="/anime?order=update" priorityCount={2} />
        <AnimeRow title="Sedang tayang" items={ongoingWithArchive} viewAllHref="/ongoing" />
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
>>>>>>> c5dfbd0 (Update maintennace)
          </section>
        ) : null}
        <AnimeRow title="Baru tamat" items={completedLatest} viewAllHref="/completed" />
      </div>
    </>
  );
}
