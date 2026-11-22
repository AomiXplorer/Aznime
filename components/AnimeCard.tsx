import Link from 'next/link';
import { memo } from 'react';
import { Play } from 'lucide-react';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';
import { cn } from '@/lib/cn';

interface AnimeCardProps {
  item: AnimeCardItem;
  priority?: boolean;
  className?: string;
  /** Tujuan kartu bila berbeda dari rute katalog biasa (mis. halaman /hentai). */
  href?: string;
  /** Label kecil di sudut kanan atas, mis. "18+". */
  badge?: string;
  /** Baris genre/status di bawah judul; dimatikan di daftar yang seragam. */
  showMeta?: boolean;
}

export function getAnimeItemHref(item: Pick<AnimeCardItem, 'slug' | 'kind'>): string {
  if (!item.slug) return '/anime';
  const encoded = encodeURIComponent(item.slug);
  return item.kind === 'episode' ? `/watch/${encoded}` : `/anime/${encoded}`;
}

function episodeLabel(item: AnimeCardItem): string | null {
  if (item.episodeNumber !== null && item.episodeNumber !== undefined) return `EP ${item.episodeNumber}`;
  return item.episode || null;
}

function AnimeCardComponent({
  item,
  priority = false,
  className,
  href: hrefOverride,
  badge,
  showMeta = true,
}: AnimeCardProps) {
  const href = hrefOverride || getAnimeItemHref(item);
  const displayTitle = item.seriesTitle || item.title;
  const meta = [item.type, item.status].filter(Boolean).join('  ');
  const ep = episodeLabel(item);

  return (
    <article className={cn('group relative cv-item', className)}>
      <Link
        href={href}
        /* Prefetch tiap kartu membuat puluhan permintaan RSC saat grid digulir.
           Dimatikan supaya scroll di HP tetap ringan; halaman tetap cepat dibuka. */
        prefetch={false}
        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {/* Transisi dibatasi ke transform + shadow saja (bukan `transition-all`)
            supaya browser tidak mengawasi seluruh properti saat hover. */}
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface shadow-md shadow-black/40 transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/60 group-active:translate-y-0 group-active:scale-[0.96]">
          <AnimeImage
            src={item.poster}
            alt={displayTitle}
            priority={priority}
            unoptimized={item.source === 'malz' || item.source === 'nekopoi'}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 170px"
            className="transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            <span className="flex h-11 w-11 scale-75 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:scale-100">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </div>
          {ep ? (
            <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow">
              {ep}
            </span>
          ) : null}
          {badge || item.isHot ? (
            <span className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
              {badge ? (
                <span className="rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold leading-none text-rose-300 ring-1 ring-inset ring-rose-400/40">
                  {badge}
                </span>
              ) : null}
              {item.isHot ? (
                <span className="rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-amber-300">
                  Hot
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-zinc-100 transition-colors group-hover:text-white">
          {displayTitle}
        </h3>
        {showMeta ? <p className="mt-0.5 h-4 truncate text-xs text-muted">{meta}</p> : null}
      </Link>
    </article>
  );
}

/* Kartu katalog bisa muncul ratusan kali pada halaman infinite scroll.
   memo mencegah re-render saat state filter/halaman berubah. */
export const AnimeCard = memo(AnimeCardComponent);
