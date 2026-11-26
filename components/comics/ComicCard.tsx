import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { ComicCard as ComicCardItem } from '@/lib/comics';

/**
 * Kedua sumber menolak hotlink: komiku.org memblokir host lain, dan
 * webtoon-phinf.pstatic.net menjawab 403 kecuali Referer-nya m.webtoons.com.
 * Jadi semua sampul lewat proxy gambar situs yang mengirim Referer benar.
 */
export function comicPosterSrc(item: ComicCardItem, width: number): string | null {
  if (!item.poster) return null;
  return `/api/img?u=${encodeURIComponent(item.poster)}&w=${width}`;
}

/* Dua ukuran saja: kartu di HP selebar ~110 px, di desktop ~150 px. Layar
   berkerapatan tinggi mengambil 340, layar biasa 200, jadi separuh kunjungan
   tidak perlu mengunduh sampul yang lebih besar dari kotaknya. */
const POSTER_WIDTHS = [200, 340] as const;

const GRID_SIZES =
  '(max-width: 639px) 33vw, (max-width: 767px) 25vw, (max-width: 1023px) 20vw, (max-width: 1279px) 17vw, 15vw';

interface ComicCardProps {
  item: ComicCardItem;
  /** Komik memakai 2:3 seperti poster anime; webtoon 3:4. */
  aspect?: '2/3' | '3/4';
  showSource?: boolean;
  className?: string;
  /** Lebar kartu di layout pemanggil, dipakai browser untuk memilih srcset. */
  sizes?: string;
}

export function ComicCard({
  item,
  aspect = '2/3',
  showSource = false,
  className,
  sizes = GRID_SIZES,
}: ComicCardProps) {
  const poster = comicPosterSrc(item, 340);
  const srcSet = poster
    ? POSTER_WIDTHS.map((width) => `${comicPosterSrc(item, width)} ${width}w`).join(', ')
    : undefined;

  return (
    <article className={cn('group relative cv-item', className)}>
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
              srcSet={srcSet}
              sizes={sizes}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] leading-tight text-zinc-600">
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
