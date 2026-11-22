import Link from 'next/link';
import type { MouseEvent } from 'react';
import type { PopularAnimeItem } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';
import { AnimeImage } from './AnimeImage';

interface RankingCardProps {
  item: PopularAnimeItem;
  rank: number;
  /** Jarak dari kartu aktif (0 = aktif). */
  dist: number;
  /** Opasitas lapisan gelap untuk kartu non-aktif. */
  dim: number;
  priority?: boolean;
  href: string;
  durationMs: number;
  ease: string;
  onClick: (e: MouseEvent<HTMLElement>) => void;
}

const FACE =
  'relative block h-full w-full cursor-pointer overflow-hidden rounded-lg bg-surface text-left ring-1 ring-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink';

/**
 * Kartu peringkat. Nomor peringkat dipakai sebagai elemen tipografi besar;
 * kartu aktif ditandai garis crimson di bawah poster, bukan glow.
 * Hanya memakai field yang tersedia: judul, poster, genre.
 */
export function RankingCard({ item, rank, dist, dim, priority, href, durationMs, ease, onClick }: RankingCardProps) {
  const isActive = dist === 0;
  const numeral = String(rank).padStart(2, '0');

  const body = (
    <>
      <AnimeImage
        src={item.poster}
        alt={item.title}
        sizes="(max-width: 640px) 60vw, 260px"
        priority={priority}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-canvas"
        style={{ opacity: dim, transition: `opacity ${durationMs}ms ${ease}` }}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-3 top-2 font-display font-bold leading-none tabular-nums',
          isActive ? 'text-[2.6rem] text-ink' : 'text-[1.6rem] text-ink/70'
        )}
      >
        {numeral}
      </span>
      <span
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-canvas via-canvas/80 to-transparent px-3.5 pb-4 pt-16 transition-opacity duration-200',
          isActive ? 'opacity-100' : 'opacity-0'
        )}
      >
        <span className="line-clamp-2 font-display text-[16px] font-bold leading-snug text-ink">{item.title}</span>
        {item.genres.length > 0 ? (
          <span className="truncate text-xs text-muted">{item.genres.slice(0, 3).join(', ')}</span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 bottom-0 h-[3px] bg-accent transition-opacity duration-200',
          isActive ? 'opacity-100' : 'opacity-0'
        )}
      />
    </>
  );

  return isActive ? (
    <Link href={href} draggable={false} onClick={onClick} className={FACE}>
      <span className="sr-only">Peringkat {rank}: </span>
      {body}
    </Link>
  ) : (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Tampilkan peringkat ${rank}: ${item.title}`}
      onClick={onClick}
      className={FACE}
    >
      {body}
    </button>
  );
}
