'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import type { DownloadBox } from '@/lib/scraper/types';

interface DownloadBoxesProps {
  boxes: DownloadBox[];
  heading?: string;
}

/**
 * Nama provider dari sumber datang dengan kapitalisasi campur (googledrive,
 * GOOGLEDRIVE, terabox). Disamakan di sini supaya daftar tidak terlihat acak,
 * tanpa mengubah tautan apa pun.
 */
const HOST_LABEL: Record<string, string> = {
  googledrive: 'Google Drive',
  terabox: 'TeraBox',
  buzzheavier: 'BuzzHeavier',
  acefile: 'AceFile',
  hidodrive: 'HidoDrive',
  teledrive: 'TeleDrive',
  mirrored: 'Mirrored',
  pixeldrain: 'Pixeldrain',
  krakenfiles: 'KrakenFiles',
  mega: 'MEGA',
};

/** Sumber kadang menulis 1080P / 720P; disamakan jadi huruf kecil. */
function qualityLabel(quality: string): string {
  return quality.trim().replace(/p$/i, 'p');
}

function qualityWeight(quality: string): number {
  const n = Number(quality.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function hostLabel(host: string): string {
  const key = host.trim().toLowerCase().replace(/\s+/g, '');
  if (HOST_LABEL[key]) return HOST_LABEL[key];
  const cleaned = host.trim().replace(/\s+/g, ' ');
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return cleaned;
}

export function DownloadBoxes({ boxes, heading = 'Tautan unduhan' }: DownloadBoxesProps) {
  const [opening, setOpening] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    []
  );

  const handleOpen = (key: string) => {
    setOpening(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpening(null), 2200);
  };

  // Resolusi tanpa tautan tidak ditampilkan supaya tidak ada baris kosong.
  const groups = boxes
    .map((box) => ({
      ...box,
      qualities: [...box.qualities]
        .filter((quality) => quality.links.length > 0)
        .sort((a, b) => qualityWeight(a.quality) - qualityWeight(b.quality)),
    }))
    .filter((box) => box.qualities.length > 0);

  const linkCount = groups.reduce(
    (total, box) => total + box.qualities.reduce((sum, q) => sum + q.links.length, 0),
    0
  );
  const qualityCount = groups.reduce((total, box) => total + box.qualities.length, 0);

  return (
    <section id="download" aria-label={heading} className="scroll-mt-20">
      <div className="flex items-baseline justify-between gap-3 border-b border-[#2b2222] pb-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-zinc-200">
          {heading}
        </h2>
        {linkCount > 0 ? (
          <span className="text-[11px] tabular-nums text-zinc-500">
            {qualityCount} resolusi · {linkCount} tautan
          </span>
        ) : null}
      </div>

      {groups.length === 0 || linkCount === 0 ? (
        <p className="py-5 text-[12.5px] text-zinc-500">
          Belum ada tautan unduhan untuk episode ini.
        </p>
      ) : (
        <div>
          {groups.map((box, boxIdx) => (
            <div key={`${box.title}-${boxIdx}`}>
              {groups.length > 1 && box.title ? (
                <p className="pt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {box.title}
                </p>
              ) : null}

              {box.qualities.map((quality, qIdx) => (
                <div
                  key={`${quality.quality}-${qIdx}`}
                  className="grid gap-x-4 gap-y-1.5 border-b border-[#241d1d] py-2.5 last:border-b-0 sm:grid-cols-[56px_1fr] sm:items-start"
                >
                  <span className="font-mono text-[11.5px] font-semibold tabular-nums text-zinc-300 sm:pt-1.5">
                    {qualityLabel(quality.quality)}
                  </span>

                  <div className="flex flex-wrap gap-1.5">
                    {quality.links.map((link, lIdx) => {
                      const key = `${boxIdx}-${qIdx}-${lIdx}`;
                      const isOpening = opening === key;
                      return (
                        <a
                          key={`${link.host}-${lIdx}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleOpen(key)}
                          className="group inline-flex h-8 items-center gap-1 rounded-md border border-[#2b2222] px-2 text-[11.5px] font-medium text-zinc-300 transition-colors duration-150 hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                          {isOpening ? (
                            <Loader2
                              className="h-3 w-3 animate-spin text-zinc-400 motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          ) : null}
                          <span className="whitespace-nowrap">{hostLabel(link.host)}</span>
                          <ArrowUpRight
                            className="h-3 w-3 shrink-0 text-zinc-600 transition-colors duration-150 group-hover:text-zinc-400"
                            aria-hidden="true"
                          />
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
