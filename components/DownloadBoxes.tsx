import { Download, ExternalLink } from 'lucide-react';
import type { DownloadBox } from '@/lib/scraper/types';

interface DownloadBoxesProps {
  boxes: DownloadBox[];
  heading?: string;
}

export function DownloadBoxes({
  boxes,
  heading = 'Tautan Unduhan',
}: DownloadBoxesProps) {
  if (boxes.length === 0) return null;

  return (
    <section aria-label={heading} className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-zinc-100">
        <Download className="h-4 w-4 text-accent-ink" aria-hidden="true" />
        {heading}
      </h2>

      <div className="space-y-4">
        {boxes.map((box, boxIdx) => (
          <div
            key={`${box.title}-${boxIdx}`}
            className="overflow-hidden rounded-lg border border-white/10 bg-surface"
          >
            {box.title ? (
              <div className="border-b border-white/10 bg-elevated px-4 py-2.5 text-sm font-medium text-zinc-200">
                {box.title}
              </div>
            ) : null}

            <div className="divide-y divide-white/[0.06]">
              {box.qualities.map((q, qIdx) => (
                <div
                  key={`${q.quality}-${qIdx}`}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-24 shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-300">
                    {q.quality}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {q.links.map((lnk, lIdx) => (
                      <a
                        key={`${lnk.host}-${lIdx}`}
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-canvas px-3 text-xs font-medium text-zinc-200 transition-colors duration-150 hover:border-accent-ink/50 hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                      >
                        <span>{lnk.host}</span>
                        <ExternalLink className="h-3 w-3 text-zinc-500" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
