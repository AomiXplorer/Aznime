import { getHome, getOngoing } from '@/lib/scraper';
import type { FeaturedAnime } from '@/lib/scraper';
import { getAniListTrailer } from '@/lib/anilist';
import { HeroSection } from '@/components/HeroSection';
import { PopularRanking } from '@/components/PopularRanking';
import { AnimeRow } from '@/components/AnimeRow';
import { AnimeGrid } from '@/components/AnimeGrid';
import { CompactAnimeList } from '@/components/CompactAnimeList';
import { SectionHeading } from '@/components/SectionHeading';
import { ErrorState } from '@/components/ErrorState';

export const revalidate = 180;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function HomePage() {
  const [homeRes, ongoingRes] = await Promise.allSettled([getHome(1), getOngoing(1)]);

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

  // Trailer AniList hanya memperkaya hero. Batas tunggunya dijaga ketat supaya
  // tidak menahan TTFB/LCP: kalau AniList lambat, hero tetap tampil dengan poster.
  const heroItems = await Promise.all(
    home.featured.slice(0, 6).map(async (f: FeaturedAnime) => ({
      ...f,
      trailer: await withTimeout(getAniListTrailer(f.title).catch(() => null), 1200, null),
    }))
  );

  return (
    <>
      <HeroSection items={heroItems} />
      <div className="relative z-10 mx-auto max-w-7xl space-y-14 px-4 pt-10 sm:px-6 lg:px-8">
        <PopularRanking
          weekly={home.popular.weekly}
          monthly={home.popular.monthly}
          alltime={home.popular.alltime}
        />
        {home.latestRelease.length > 0 ? (
          <section aria-label="Episode terbaru" className="space-y-5">
            <SectionHeading title="Episode terbaru" href="/anime?order=update" />
            <AnimeGrid
              items={home.latestRelease.slice(0, 12)}
              className="gap-y-7 md:grid-cols-6 xl:grid-cols-6"
            />
          </section>
        ) : null}
        <AnimeRow title="Sedang tayang" items={ongoing} viewAllHref="/ongoing" />
        {home.completedLatest.length > 0 ? (
          <section aria-label="Baru tamat" className="space-y-2">
            <SectionHeading title="Baru tamat" href="/completed" />
            <CompactAnimeList items={home.completedLatest.slice(0, 6)} />
          </section>
        ) : null}
      </div>
    </>
  );
}
