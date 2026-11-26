'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Film } from 'lucide-react';
import { cn } from '@/lib/cn';

type ReferrerPolicy =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

export interface RevealImageProps {
  src?: string | null;
  alt: string;
  /** Isi penuh wadah. Wadah pemanggil wajib `relative`. Bawaan: true. */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  srcSet?: string;
  /**
   * Muat segera dengan `fetchpriority="high"`. Hanya untuk gambar yang benar
   * benar terlihat sebelum pengguna menggulir apa pun (LCP).
   */
  priority?: boolean;
  /** Bawaan: `lazy` untuk semua yang bukan `priority`. */
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  referrerPolicy?: ReferrerPolicy;
  /** Kelas untuk elemen `<img>`. */
  className?: string;
  /** Kelas untuk pembungkus; menambah, bukan mengganti bawaannya. */
  frameClassName?: string;
  /** Rasio cadangan saat `fill` dimatikan, mis. "2 / 3". */
  aspect?: string;
  /** Isi pengganti saat URL kosong atau permintaannya gagal. */
  fallback?: ReactNode;
  fallbackClassName?: string;
  style?: CSSProperties;
  onLoad?: () => void;
}

function PosterFallback({
  alt,
  className,
}: {
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center bg-[#131010] p-4 text-center',
        className
      )}
    >
      <Film className="mb-2 h-6 w-6 text-zinc-600" aria-hidden="true" />
      <span className="line-clamp-2 text-xs font-medium text-zinc-500">{alt}</span>
    </div>
  );
}

/**
 * Gambar dengan pemunculan yang tenang: placeholder gelap memudar, gambar
 * menajam, tanpa lompatan tata letak.
 *
 * Semua penanda reveal ditulis langsung ke DOM lewat atribut `data-reveal`,
 * bukan lewat state React. Satu poster yang selesai dimuat tidak perlu
 * me-render ulang apa pun, dan tidak ada satu frame pun yang sempat
 * menampilkan gambar transparan sebelum state sempat mengalir.
 *
 * Tiga kondisi ditangani:
 *   instant  gambar sudah lengkap saat elemen terpasang (cache browser,
 *            tombol kembali, atau selesai sebelum hidrasi) -> tampil langsung
 *   loaded   gambar selesai setelah terpasang -> transisi 340 ms
 *   (kosong) masih diunduh -> placeholder
 */
export function RevealImage({
  src,
  alt,
  fill = true,
  width,
  height,
  sizes,
  srcSet,
  priority = false,
  loading,
  decoding = 'async',
  fetchPriority,
  referrerPolicy = 'no-referrer',
  className,
  frameClassName,
  aspect,
  fallback,
  fallbackClassName,
  style,
  onLoad,
}: RevealImageProps) {
  const [failed, setFailed] = useState(false);

  /* Dipanggil sekali saat elemen terpasang dan setiap kali `src` berganti.
     Pemeriksaan `complete` di sini menyelamatkan dua kasus yang paling sering
     membuat thumbnail "berhenti" di opacity nol, karena keduanya terjadi
     sebelum React sempat memasang `onLoad`/`onError`:

       - gambar sudah lengkap saat hidrasi (cache browser, tombol kembali)
       - permintaannya sudah gagal saat hidrasi (host memblokir, jaringan mati)

     `currentSrc` membedakan keduanya dengan aman: gambar lazy yang belum
     mulai diunduh punya `complete === false`, sedangkan gambar yang gagal
     menyimpan URL yang gagal di `currentSrc`. */
  const attach = useCallback(
    (node: HTMLSpanElement | null) => {
      if (!node) return;
      const img = node.firstElementChild as HTMLImageElement | null;
      if (!img || !img.complete) {
        delete node.dataset.reveal;
        return;
      }
      if (img.naturalWidth > 0) {
        node.dataset.reveal = 'instant';
      } else if (img.currentSrc) {
        setFailed(true);
      } else {
        delete node.dataset.reveal;
      }
    },
    [src]
  );

  if (!src || failed) {
    return <>{fallback ?? <PosterFallback alt={alt} className={fallbackClassName} />}</>;
  }

  const frameStyle: CSSProperties | undefined =
    !fill && aspect ? { aspectRatio: aspect, ...style } : style;

  return (
    <span
      ref={attach}
      className={cn('media-frame', fill ? 'absolute inset-0' : 'relative block w-full', frameClassName)}
      style={frameStyle}
    >
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={priority ? 'eager' : (loading ?? 'lazy')}
        fetchPriority={priority ? 'high' : fetchPriority}
        decoding={decoding}
        referrerPolicy={referrerPolicy}
        draggable={false}
        onLoad={(event) => {
          const frame = event.currentTarget.parentElement;
          if (frame) frame.dataset.reveal = 'loaded';
          onLoad?.();
        }}
        onError={() => setFailed(true)}
        className={cn(
          fill ? 'absolute inset-0 h-full w-full object-cover' : 'block h-auto w-full',
          className
        )}
      />
    </span>
  );
}
