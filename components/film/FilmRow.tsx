'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FilmCard as FilmCardItem } from '@/lib/film';
import { FilmCard } from './FilmCard';

interface FilmRowProps {
  title: string;
  items: FilmCardItem[];
  viewAllHref?: string;
  note?: string;
}

/**
 * Baris film di halaman depan. Bentuknya mengikuti baris anime dan komik:
 * garis tipis sebagai kepala, kartu digulir mendatar, tombol panah di layar
 * lebar. Baris tidak dirender saat sumber sedang kosong/down.
 */
export function FilmRow({ title, items, viewAllHref, note }: FilmRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(320, el.clientWidth * 0.8);
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  if (items.length === 0) return null;

  return (
    <section aria-label={title} className="group/row">
      <div className="mb-3 flex items-end justify-between gap-4 border-b border-[#2b2222] pb-2">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white sm:text-[19px]">
            {title}
          </h2>
          {note ? <p className="mt-0.5 text-[11.5px] text-zinc-500">{note}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="mr-1 text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white"
            >
              Semua
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => scrollByAmount('left')}
            aria-label="Geser ke kiri"
            className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#2b2222] text-zinc-400 transition-colors duration-150 hover:border-white/25 hover:text-white sm:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount('right')}
            aria-label="Geser ke kanan"
            className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#2b2222] text-zinc-400 transition-colors duration-150 hover:border-white/25 hover:text-white sm:inline-flex"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[30vw] shrink-0 snap-start sm:w-[22vw] md:w-[18vw] lg:w-[15vw] xl:w-[168px]"
          >
            <FilmCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
