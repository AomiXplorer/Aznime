import type { ReactNode } from 'react';

interface SectionHeadingProps {
  /** Judul bagian, ditulis singkat dan dalam huruf kapital kecil. */
  title: string;
  /** Keterangan pendukung di kanan judul (jumlah tautan, jumlah episode). */
  meta?: ReactNode;
  /** Id untuk heading, dipakai bila bagian perlu dirujuk tautan jangkar. */
  id?: string;
}

/**
 * Judul bagian di halaman tonton. Satu komponen dipakai unduhan dan daftar
 * episode supaya kedua bagian punya garis, ukuran huruf, dan jarak yang sama
 * persis, bukan dua salinan kelas yang perlahan berbeda.
 */
export function SectionHeading({ title, meta, id }: SectionHeadingProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <h2
        id={id}
        className="min-w-0 text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-zinc-200"
      >
        {title}
      </h2>
      {meta ? (
        <span className="shrink-0 text-[11px] leading-none tabular-nums text-zinc-500">{meta}</span>
      ) : null}
    </div>
  );
}
