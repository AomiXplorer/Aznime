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
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Download className="h-4 w-4 text-accent-ink" aria-hidden="true" />
        {heading}
      </h2>

      <div className="space-y-4">
        {boxes.map((box, boxIdx) => (
          <div
            key={`${box.title}-${boxIdx}`}
            className="overflow-hidden rounded-xl border border-line bg-surface"
          >
            {box.title ? (
              <div className="border-b border-line bg-elevated px-4 py-2.5 text-sm font-semibold text-ink">
                {box.title}
              </div>
            ) : null}

            <div className="divide-y divide-white/[0.06]">
              {box.qualities.map((q, qIdx) => (
                <div
                  key={`${q.quality}-${qIdx}`}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-24 shrink-0 font-mono text-xs font-semibold tabular-nums text-ink">
                    {q.quality}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {q.links.map((lnk, lIdx) => (
                      <a
                        key={`${lnk.host}-${lIdx}`}
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 text-xs font-semibold text-muted transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                      >
                        <span>{lnk.host}</span>
                        <ExternalLink
                          className="h-3 w-3 text-faint transition-colors group-hover:text-white"
                          aria-hidden="true"
                        />
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
