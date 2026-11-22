import Link from 'next/link';
import { ChevronRight, Crown, Play } from 'lucide-react';
import type { PopularAnimeItem } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';

interface RankingItemProps {
  item: PopularAnimeItem;
  rank: number;
  href: string;
}

/**
 * Kartu Sorotan Utama #01 di sisi kiri Bento Spotlight.
 * Poster ditampilkan pada ukuran proporsional agar tetap tajam 100%.
 */
export function SpotlightRankingCard({ item, rank, href }: RankingItemProps) {
  const numeral = String(rank).padStart(2, '0');

  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative flex h-full flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-line-accent bg-surface p-5 transition-colors duration-200 hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at top right, rgba(225, 29, 72, 0.14), transparent 62%)',
        }}
      />

      <div className="relative flex items-start gap-4 sm:gap-5">
        <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl bg-elevated shadow-lg shadow-black/50 ring-1 ring-white/15 sm:w-36">
          <AnimeImage
            src={item.poster}
            alt={item.title}
            priority
            sizes="(max-width: 640px) 112px, 144px"
            className="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-1 font-mono text-xs font-bold leading-none tabular-nums text-white shadow-md">
            <Crown className="h-3 w-3" aria-hidden="true" />
            #{numeral}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
          <p className="font-mono text-xs font-semibold text-accent-ink">
            Peringkat #{numeral} Populer
          </p>
          <h3 className="line-clamp-3 font-display text-xl font-bold leading-snug text-ink transition-colors group-hover:text-white sm:text-2xl">
            {item.title}
          </h3>
          {item.genres.length > 0 ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted">
              {item.genres.slice(0, 3).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-xs font-medium text-muted">Pilihan teratas periode ini</span>
        <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-white transition-colors duration-150 group-hover:bg-accent-hover">
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          Tonton Sekarang
        </span>
      </div>
    </Link>
  );
}

/**
 * Baris peringkat ringkas untuk posisi #02–#05 di sisi kanan Bento Spotlight.
 * Thumbnail 48×72px sesuai ukuran aslinya agar bebas artefak pembesaran.
 */
export function CompactRankingRow({ item, rank, href }: RankingItemProps) {
  const numeral = String(rank).padStart(2, '0');

  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex flex-1 items-center gap-3.5 rounded-xl border border-line bg-surface/85 p-2.5 transition-colors duration-150 hover:border-line-accent hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink sm:px-3.5"
    >
      <span className="w-9 shrink-0 text-center font-display text-xl font-bold tabular-nums text-faint transition-colors duration-150 group-hover:text-accent-ink">
        {numeral}
      </span>

      <div className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-elevated ring-1 ring-white/[0.06]">
        <AnimeImage
          src={item.poster}
          alt={item.title}
          sizes="48px"
          className="transition-transform duration-300 ease-out group-hover:scale-[1.04]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-semibold text-ink transition-colors duration-150 group-hover:text-white">
          {item.title}
        </h3>
        {item.genres.length > 0 ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {item.genres.slice(0, 3).join(' · ')}
          </p>
        ) : null}
      </div>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-faint transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-accent-ink"
        aria-hidden="true"
      />
    </Link>
  );
}
