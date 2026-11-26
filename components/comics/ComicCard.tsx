import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { ComicCard as ComicCardItem } from '@/lib/comics';

/**
 * Kedua sumber menolak hotlink: komiku.org memblokir host lain, dan
 * webtoon-phinf.pstatic.net menjawab 403 kecuali Referer-nya m.webtoons.com.
 * Jadi semua sampul lewat proxy gambar situs yang mengirim Referer benar.
 */
export function comicPosterSrc(item: ComicCardItem, width = 340): string | null {
  if (!item.poster) return null;
  return `/api/img?u=${encodeURIComponent(item.poster)}&w=${width}`;
}

interface ComicCardProps {
  item: ComicCardItem;
  /** Komik memakai 2:3 seperti poster anime; webtoon 3:4. */
  aspect?: '2/3' | '3/4';
  showSource?: boolean;
  className?: string;
}

export function ComicCard({ item, aspect = '2/3', showSource = false, className }: ComicCardProps) {
  const poster = comicPosterSrc(item);

  return (
    <article className={cn('group relative', className)}>
      <Link
        href={item.href}
        prefetch={false}
        className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-[6px] bg-surface ring-1 ring-inset ring-white/[0.09] transition-shadow duration-200 group-hover:ring-white/30',
            aspect === '2/3' ? 'aspect-[2/3]' : 'aspect-[3/4]'
          )}
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-600">
              Tanpa poster
            </div>
          )}

          {item.latest ? (
            <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded-[3px] bg-black/85 px-1.5 py-[3px] text-[10.5px] font-semibold leading-none tracking-[0.02em] text-white ring-1 ring-inset ring-white/15">
              {item.latest}
            </span>
          ) : null}

          {showSource ? (
            <span className="absolute right-1.5 top-1.5 rounded-[3px] bg-black/85 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-zinc-300 ring-1 ring-inset ring-white/10">
              {item.source === 'komiku' ? 'Komik' : 'Webtoon'}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 line-clamp-2 text-[12.5px] font-medium leading-snug text-zinc-200 transition-colors duration-150 group-hover:text-white">
          {item.title}
        </h3>
        {item.meta ? (
          <p className="mt-0.5 truncate text-[11px] leading-relaxed text-zinc-500">{item.meta}</p>
        ) : null}
      </Link>
    </article>
  );
}
