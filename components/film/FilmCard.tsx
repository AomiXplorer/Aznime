import Link from 'next/link';
import { cn } from '@/lib/cn';
import { RevealImage } from '@/components/media/RevealImage';
import { filmPosterUrl, type FilmCard as FilmCardItem } from '@/lib/film';

/**
 * Sampul film lewat /api/img milik situs, sama seperti poster anime dan sampul
 * komik: host sumber hanya diizinkan dari allowlist rute itu, dan berkasnya
 * dikecilkan di sana sebelum dikirim ke browser.
 */
export function filmPosterSrc(item: FilmCardItem, width: number): string | null {
  return filmPosterUrl(item.poster, width);
}

const POSTER_WIDTHS = [160, 240] as const;

const GRID_SIZES =
  '(max-width: 639px) 30vw, (max-width: 767px) 22vw, (max-width: 1023px) 18vw, (max-width: 1279px) 15vw, 168px';

interface FilmCardProps {
  item: FilmCardItem;
  className?: string;
  sizes?: string;
}

/** Kartu film: poster 2:3, label kualitas di kiri atas, judul dua baris. */
export function FilmCard({ item, className, sizes = GRID_SIZES }: FilmCardProps) {
  const poster = filmPosterSrc(item, 240);
  const srcSet = poster
    ? POSTER_WIDTHS.map((width) => `${filmPosterSrc(item, width)} ${width}w`).join(', ')
    : undefined;

  return (
    <article className={cn('group relative cv-item', className)}>
      <Link
        href={item.href}
        className="block rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[6px] bg-surface ring-1 ring-inset ring-white/[0.09] transition-shadow duration-200 group-hover:ring-white/30">
          <RevealImage
            src={poster}
            srcSet={srcSet}
            sizes={sizes}
            alt={item.title}
            className="object-cover"
            fallback={
              <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] leading-tight text-zinc-600">
                Tanpa poster
              </div>
            }
          />

          {item.quality ? (
            <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded-[3px] bg-black/85 px-1.5 py-[3px] text-[10.5px] font-semibold leading-none tracking-[0.02em] text-white ring-1 ring-inset ring-white/15">
              {item.quality}
            </span>
          ) : null}

          {item.rating ? (
            <span className="absolute right-1.5 top-1.5 rounded-[3px] bg-black/85 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.06em] text-amber-300 ring-1 ring-inset ring-white/10">
              {item.rating}
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 line-clamp-2 text-[12.5px] font-medium leading-snug text-zinc-200 transition-colors duration-150 group-hover:text-white">
          {item.title}
        </h3>
      </Link>
    </article>
  );
}
