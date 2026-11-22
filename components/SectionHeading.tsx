import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface SectionHeadingProps {
  title: string;
  /** Teks pendukung satu baris di bawah judul (hanya bila memang berguna). */
  description?: string;
  href?: string;
  linkLabel?: string;
  /** Kontrol tambahan di sisi kanan (mis. pemilih periode). */
  children?: ReactNode;
}

/**
 * Judul section editorial: garis tipis di bawah seluruh lebar, dengan segmen
 * crimson pendek tepat di bawah judul. Hierarki datang dari tipografi dan garis,
 * bukan dari kotak/badge.
 */
export function SectionHeading({ title, description, href, linkLabel = 'Lihat semua', children }: SectionHeadingProps) {
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-3">
      <div className="relative">
        <h2 className="font-display text-[1.35rem] font-bold leading-none text-ink sm:text-[1.5rem]">
          {title}
        </h2>
        {description ? <p className="mt-1.5 text-[13px] text-muted">{description}</p> : null}
        <span
          aria-hidden="true"
          className="absolute -bottom-[13px] left-0 h-0.5 w-12 rounded-full bg-accent"
        />
      </div>
      {(children || href) ? (
        <div className="flex items-center gap-3">
          {children}
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-0.5 whitespace-nowrap text-[13px] font-semibold text-muted transition-colors duration-150 hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
            >
              {linkLabel}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
