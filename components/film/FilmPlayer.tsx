'use client';

import { useState } from 'react';
import { ExternalLink, MonitorPlay } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FilmPlayerProps {
  embeds: string[];
  title: string;
}

/**
 * Pemutar film. Sumber tidak memberi berkas video, hanya beberapa iframe
 * pemutar pihak ketiga, jadi yang bisa dilakukan situs ini adalah memilih
 * salah satunya dan menampilkannya. `referrerPolicy="no-referrer"` dipakai
 * supaya host pemutar tidak menolak permintaan yang membawa Referer aznime.
 */
export function FilmPlayer({ embeds, title }: FilmPlayerProps) {
  const [index, setIndex] = useState(0);

  if (embeds.length === 0) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-[#2b2222] bg-[#131010] px-6 text-center">
        <MonitorPlay className="h-6 w-6 text-zinc-600" aria-hidden="true" />
        <p className="text-sm text-zinc-400">Sumber ini tidak menyediakan pemutar untuk judul tersebut.</p>
      </div>
    );
  }

  const active = embeds[Math.min(index, embeds.length - 1)];

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
        <iframe
          key={active}
          src={active}
          title={`Pemutar ${title}`}
          className="h-full w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {embeds.map((embed, position) => (
          <button
            key={embed}
            type="button"
            onClick={() => setIndex(position)}
            aria-pressed={position === index}
            className={cn(
              'cursor-pointer rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
              position === index
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-[#2b2222] text-zinc-400 hover:border-white/20 hover:text-white'
            )}
          >
            Server {position + 1}
          </button>
        ))}
        <a
          href={active}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white"
        >
          Buka di tab baru
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
