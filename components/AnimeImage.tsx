'use client';

import { memo, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Film } from 'lucide-react';
import { cn } from '@/lib/cn';

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
}

function AnimeImageComponent({
  src,
  alt,
  fill = true,
  width,
  height,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px',
  priority = false,
  unoptimized = false,
  proxyWidth,
  className,
  fallbackClassName,
}: AnimeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  /* Poster yang sudah ada di cache browser selesai dimuat sebelum React
     sempat memasang onLoad, sehingga event-nya tidak pernah datang dan
     gambar tertahan di opacity-0. Itulah yang membuat sebagian thumbnail
     tampak "berhenti" padahal gambarnya sudah ada. Cek ulang saat mount. */
  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    if (node.complete && node.naturalWidth > 0) setLoaded(true);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center bg-[#131010] p-4 text-center',
          fallbackClassName
        )}
      >
        <Film className="mb-2 h-6 w-6 text-zinc-600" aria-hidden="true" />
        <span className="line-clamp-2 text-xs font-medium text-zinc-500">{alt}</span>
      </div>
    );
  }

  const displaySrc = proxyWidth ? proxiedImage(src, proxyWidth) : src;

  return (
    <>
      {/* Alas diam di belakang poster: kartu terlihat siap sejak byte pertama,
          bukan kotak hitam kosong yang baru terisi belakangan. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 bg-surface motion-safe:animate-pulse',
          loaded || priority ? 'opacity-0' : 'opacity-100',
          'transition-opacity duration-150'
        )}
      />
      <Image
        ref={imgRef}
        src={displaySrc}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
        loading={priority ? undefined : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
        className={cn(
          'relative object-cover transition-opacity duration-150 ease-out',
          loaded || priority ? 'opacity-100' : 'opacity-0',
          className
        )}
      />
    </>
  );
}

const PROXYABLE_HOST = /(^|\.)(hidoristream\.online|animein\.net|animeinweb\.com|storages\.animein\.net|nekopoi\.care|anilist\.co|ytimg\.com)$/i;

function proxiedImage(src: string, width: number): string {
  try {
    if (!PROXYABLE_HOST.test(new URL(src).hostname)) return src;
    return `/api/img?u=${encodeURIComponent(src)}&w=${width}&q=72&f=webp`;
  } catch {
    return src;
  }
}

export const AnimeImage = memo(AnimeImageComponent);
