import Link from 'next/link';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';
import { getAnimeItemHref } from './AnimeCard';
import { cn } from '@/lib/cn';

interface CompactAnimeListProps {
  items: AnimeCardItem[];
  className?: string;
}

/**
 * Daftar kartu padat: thumbnail tajam + judul + metadata dalam grid 3 kolom.
 * Dipakai untuk section "Baru tamat" agar ritme halaman tetap variatif.
 */
export function CompactAnimeList({ items, className }: CompactAnimeListProps) {
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map((item, idx) => {
        const title = item.seriesTitle || item.title;
        const ep =
          item.episodeNumber !== null && item.episodeNumber !== undefined
            ? `EP ${item.episodeNumber}`
            : item.episode;
        return (
          <li key={`${item.kind}-${item.slug || item.url || idx}`}>
            <Link
              href={getAnimeItemHref(item)}
              prefetch={false}
              className="group flex items-center gap-3.5 rounded-xl border border-line bg-surface/60 p-3 transition-colors duration-150 hover:border-line-accent hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
            >
              <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-lg bg-elevated ring-1 ring-white/[0.06]">
                <AnimeImage
                  src={item.poster}
                  alt=""
                  sizes="48px"
                  className="transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink/90 transition-colors duration-150 group-hover:text-white">
                  {title}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-xs text-muted">
                  {ep ? (
                    <span className="font-mono font-semibold tabular-nums text-accent-ink">
                      {ep}
                    </span>
                  ) : null}
                  {item.type ? <span>{item.type}</span> : null}
                  {item.status ? <span className="text-faint">{item.status}</span> : null}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
