'use client';

import { useState } from 'react';
import { Play, Youtube } from 'lucide-react';
import type { AniListTrailer } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';

interface AnimeTrailerSectionProps {
  title: string;
  trailer: AniListTrailer | null;
}

export function AnimeTrailerSection({ title, trailer }: AnimeTrailerSectionProps) {
  const [playing, setPlaying] = useState(false);

  if (!trailer?.id || trailer.site !== 'youtube') {
    return null;
  }

  return (
    <section aria-label="Trailer resmi" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-zinc-100">
          <Youtube className="h-5 w-5 text-rose-400" aria-hidden="true" />
          Trailer Resmi
        </h2>
        {trailer.matchedTitle ? (
          <span className="text-xs text-zinc-400">
            Sumber: AniList ({trailer.matchedTitle})
          </span>
        ) : null}
      </div>

      <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.id)}?autoplay=1&rel=0`}
            title={`Trailer ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Putar trailer ${title}`}
            className="group relative flex h-full w-full cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <AnimeImage
              src={trailer.thumbnail || trailer.bannerImage}
              alt={`Thumbnail trailer ${title}`}
              sizes="(max-width: 768px) 100vw, 768px"
              className="opacity-80 transition-opacity duration-150 group-hover:opacity-95"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
            />
            <span className="relative z-10 inline-flex items-center gap-2 rounded-md bg-[#be123c] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors duration-150 group-hover:bg-[#9f1239]">
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Putar Trailer
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
