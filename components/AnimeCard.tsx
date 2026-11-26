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
  /** Kartu di atas permukaan gelap (bawaan) atau pita terang warna tulang. */
  tone?: 'dark' | 'light';
}

export function getAnimeItemHref(item: Pick<AnimeCardItem, 'slug' | 'kind'> & { source?: AnimeCardItem['source'] }): string {
  if (!item.slug) return '/anime';
  const encoded = encodeURIComponent(item.slug);
  if (item.source === 'lk21') return `/film/${encoded}`;
  return item.kind === 'episode' ? `/watch/${encoded}` : `/anime/${encoded}`;
}

function episodeLabel(item: AnimeCardItem): string | null {
  if (item.episodeNumber !== null && item.episodeNumber !== undefined) return `EP ${item.episodeNumber}`;
  return item.episode || null;
}

/**
 * Kartu poster datar: tanpa lift, tanpa zoom gambar saat hover. Satu-satunya
 * gerak adalah garis tepi yang menyala dan warna judul, jadi grid tetap diam
 * saat kursor lewat. Nomor episode netral; warna aksen disimpan untuk status.
 */
function AnimeCardComponent({
  item,
  priority = false,
  className,
  href: hrefOverride,
  badge,
  showMeta = true,
  tone = 'dark',
}: AnimeCardProps) {
  const light = tone === 'light';
  const href = hrefOverride || getAnimeItemHref(item);
  const displayTitle = item.seriesTitle || item.title;
  const meta = [item.type, item.status].filter(Boolean).join(' · ');
  const ep = episodeLabel(item);

  return (
    <article className={cn('group relative cv-item', className)}>
      <Link
        href={href}
        /* Prefetch tiap kartu membuat puluhan permintaan RSC saat grid digulir.
           Dimatikan supaya scroll di HP tetap ringan; halaman tetap cepat dibuka. */
        prefetch={false}
        className={cn(
          'block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          light
            ? 'focus-visible:ring-ink focus-visible:ring-offset-bone'
            : 'focus-visible:ring-white/70 focus-visible:ring-offset-canvas'
        )}
      >
        <div
          className={cn(
            'relative aspect-[2/3] w-full overflow-hidden rounded-[6px] ring-1 ring-inset transition-shadow duration-200',
            light
              ? 'bg-[#ded5cc] ring-black/15 group-hover:ring-black/40'
              : 'bg-surface ring-white/[0.09] group-hover:ring-white/30'
          )}
        >
          <AnimeImage
            src={item.poster}
            alt={displayTitle}
            priority={priority}
            proxyWidth={340}
            unoptimized={item.source === 'malz' || item.source === 'nekopoi'}
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 170px"
            fallbackClassName={
              light ? 'bg-[#ded5cc] [&_svg]:text-[#a8968c] [&_span]:text-[#6f625d]' : undefined
            }
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-[4px]',
                light ? 'bg-ink text-bone' : 'bg-white text-black'
              )}
            >
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </div>
          {ep ? (
            <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-black/85 px-1.5 py-[3px] text-[10.5px] font-semibold leading-none tracking-[0.02em] text-white ring-1 ring-inset ring-white/15">
              {ep}
            </span>
          ) : null}
          {badge || item.isHot ? (
            <span className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
              {badge ? (
                <span className="rounded-[3px] bg-black/85 px-1.5 py-[3px] text-[10.5px] font-semibold leading-none text-rose-300 ring-1 ring-inset ring-rose-400/40">
                  {badge}
                </span>
              ) : null}
              {item.isHot ? (
                <span className="rounded-[3px] bg-black/85 px-1.5 py-[3px] text-[10.5px] font-semibold leading-none text-amber-300 ring-1 ring-inset ring-white/10">
                  Hot
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        <h3
          className={cn(
            'mt-1.5 line-clamp-2 min-h-[2.4rem] text-[12.5px] font-medium leading-[1.4] transition-colors duration-150',
            light ? 'text-ink group-hover:text-black' : 'text-zinc-200 group-hover:text-white'
          )}
        >
          {displayTitle}
        </h3>
        {showMeta ? (
          <p className={cn('mt-0.5 h-4 truncate text-[11px]', light ? 'text-[#6f625d]' : 'text-zinc-500')}>
            {meta}
          </p>
        ) : null}
      </Link>
    </article>
  );
}

/* Kartu katalog bisa muncul ratusan kali pada halaman infinite scroll.
   memo mencegah re-render saat state filter/halaman berubah. */
export const AnimeCard = memo(AnimeCardComponent);
