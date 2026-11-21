'use client';

import { useState } from 'react';
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
  className?: string;
  fallbackClassName?: string;
}

export function AnimeImage({
  src,
  alt,
  fill = true,
  width,
  height,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px',
  priority = false,
  className,
  fallbackClassName,
}: AnimeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#181b23] via-[#12141a] to-[#0a0b0e] p-4 text-center',
          fallbackClassName
        )}
      >
        <Film className="mb-2 h-6 w-6 text-zinc-600" aria-hidden="true" />
        <span className="line-clamp-2 text-xs font-medium text-zinc-500">{alt}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setHasError(true)}
      className={cn(
        'object-cover transition-opacity duration-200 ease-out',
        loaded || priority ? 'opacity-100' : 'opacity-0',
        className
      )}
    />
  );
}
