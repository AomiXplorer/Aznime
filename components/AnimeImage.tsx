'use client';

import { memo } from 'react';
import { RevealImage } from './media/RevealImage';

interface AnimeImageProps {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  /** Lewati optimizer Next untuk gambar dari CDN yang menolak permintaan server. */
  unoptimized?: boolean;
  /** Kalau diisi, gambar dari host yang didukung diproses lewat /api/img. */
  proxyWidth?: number;
  className?: string;
  fallbackClassName?: string;
  frameClassName?: string;
}

/**
 * Poster anime. Semua perilaku pemunculannya ada di `RevealImage`; berkas ini
 * hanya menambahkan aturan proksi `/api/img` milik Aznime supaya halaman tidak
 * perlu tahu host mana yang perlu diterjemahkan.
 *
 * `unoptimized` dipertahankan demi kompatibilitas pemanggil: optimizer gambar
 * Next memang dimatikan di `next.config.ts` (kuota transformasi), jadi nilai
 * apa pun menghasilkan elemen <img> yang sama.
 */
function AnimeImageComponent({
  src,
  alt,
  fill = true,
  width,
  height,
  sizes,
  priority = false,
  proxyWidth,
  className,
  fallbackClassName,
  frameClassName,
}: AnimeImageProps) {
  const displaySrc = proxyWidth && src ? proxiedImage(src, proxyWidth) : src;

  return (
    <RevealImage
      src={displaySrc}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      referrerPolicy="no-referrer"
      className={className}
      fallbackClassName={fallbackClassName}
      frameClassName={frameClassName}
    />
  );
}

const PROXYABLE_HOST = /(^|\.)(hidoristream\.online|animein\.net|animeinweb\.com|storages\.animein\.net|nekopoi\.care|anilist\.co|ytimg\.com)$/i;

function proxiedImage(src: string, width: number): string {
  try {
    const host = new URL(src).hostname;
    if (host !== 'poster.assetsy.de' && !PROXYABLE_HOST.test(host)) return src;
    return `/api/img?u=${encodeURIComponent(src)}&w=${width}&q=72&f=webp`;
  } catch {
    return src;
  }
}

export const AnimeImage = memo(AnimeImageComponent);
