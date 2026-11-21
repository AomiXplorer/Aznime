'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import type { DownloadBox } from '@/lib/scraper/types';

interface DownloadBoxesProps {
  boxes: DownloadBox[];
  heading?: string;
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

  const linkCount = boxes.reduce(
    (total, box) => total + box.qualities.reduce((sum, q) => sum + q.links.length, 0),
    0
  );
  const qualityCount = boxes.reduce((total, box) => total + box.qualities.length, 0);

  return (
    <section
      id="download"
      aria-label={heading}
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e13]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Download className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          {heading}
        </h2>
        {linkCount > 0 ? (
          <span className="text-[11px] text-zinc-500">
            {qualityCount} resolusi · {linkCount} tautan
          </span>
        ) : null}
      </div>

      {boxes.length === 0 || linkCount === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-zinc-500">
          Belum ada tautan unduhan untuk episode ini.
        </p>
      ) : (
        <div>
          {boxes.map((box, boxIdx) => (
            <div key={`${box.title}-${boxIdx}`} className="border-b border-white/[0.05] last:border-b-0">
              {boxes.length > 1 && box.title ? (
                <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  {box.title}
                </p>
              ) : null}

              <div className="divide-y divide-white/[0.04]">
                {box.qualities.map((quality, qIdx) => (
                  <div
                    key={`${quality.quality}-${qIdx}`}
                    className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="inline-flex w-16 shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-300">
                      <span className="h-1 w-1 rounded-full bg-zinc-600" aria-hidden="true" />
                      {quality.quality}
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
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-[11px] font-medium text-zinc-300 transition-colors duration-150 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                          >
                            {isOpening ? (
                              <Loader2
                                className="h-3 w-3 animate-spin text-zinc-400 motion-reduce:animate-none"
                                aria-hidden="true"
                              />
                            ) : (
                              <Download className="h-3 w-3 text-zinc-500" aria-hidden="true" />
                            )}
                            <span>{link.host}</span>
                            <ExternalLink className="h-2.5 w-2.5 text-zinc-600" aria-hidden="true" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
