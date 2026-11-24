'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2, Search, X } from 'lucide-react';
import type { AnimeCardItem } from '@/lib/scraper/types';
import { nekopoiCardHref } from '@/lib/nekopoi-links';
import { cn } from '@/lib/cn';
import { AnimeImage } from './AnimeImage';

interface HentaiSearchProps {
  /** Nilai awal dari ?q= supaya kotak tetap terisi saat halaman dimuat ulang. */
  initialQuery: string;
}

/**
 * Pencarian bagian /hentai.
 *
 * Hasil muncul sambil mengetik lewat /api/nekopoi/search, jadi tidak perlu
 * menekan Enter dan tidak bergantung pada navigasi penuh. Enter tetap membuka
 * /hentai?q= yang bisa dibagikan, dan formulirnya juga bekerja tanpa JavaScript.
 */
export function HentaiSearch({ initialQuery }: HentaiSearchProps) {
  const router = useRouter();
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<AnimeCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/nekopoi/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { items?: AnimeCardItem[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'Pencarian gagal');
        setItems(data.items || []);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Pencarian sedang tidak bisa dipakai. Coba lagi sebentar.');
        setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const goToResults = () => {
    if (!trimmed) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/hentai?q=${encodeURIComponent(trimmed)}`);
  };

  const clear = () => {
    setQuery('');
    setItems([]);
    setOpen(false);
    router.push('/hentai');
    inputRef.current?.focus();
  };

  const showPanel = open && trimmed.length >= 2;

  return (
    <div ref={boxRef} className="relative w-full sm:max-w-md">
      <form
        action="/hentai"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          goToResults();
        }}
        role="search"
      >
        <label htmlFor="hentai-search" className="sr-only">
          Cari judul hentai
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id="hentai-search"
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((prev) => (items.length === 0 ? -1 : (prev + 1) % items.length));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((prev) =>
                items.length === 0 ? -1 : prev <= 0 ? items.length - 1 : prev - 1
              );
            } else if (event.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
              event.preventDefault();
              setOpen(false);
              router.push(nekopoiCardHref(items[activeIndex]));
            }
          }}
          placeholder="Cari judul, mis. kuroinu"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-10 w-full rounded-[4px] border border-white/10 bg-white/[0.03] pl-9 pr-9 text-[13px] text-zinc-100 placeholder:text-zinc-500 transition-colors duration-150 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.05] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Hapus pencarian"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-zinc-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[6px] border border-white/12 bg-[#131010] shadow-2xl shadow-black/60">
          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="flex items-center gap-2 px-3 py-4 text-[12.5px] text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Mencari…
              </p>
            ) : error ? (
              <p role="alert" className="px-3 py-4 text-[12.5px] text-rose-400">
                {error}
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-[12.5px] text-zinc-400">
                Tidak ada judul yang cocok dengan “{trimmed}”.
              </p>
            ) : (
              <ul id={listId} role="listbox" aria-label="Hasil pencarian hentai">
                {items.map((item, index) => {
                  const selected = index === activeIndex;
                  return (
                    <li key={`${item.slug}-${index}`} role="option" aria-selected={selected}>
                      <Link
                        href={nekopoiCardHref(item)}
                        prefetch={false}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-2.5 py-2 transition-colors duration-150',
                          selected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
                        )}
                      >
                        <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[3px] bg-[#1b1515]">
                          <AnimeImage src={item.poster} alt={item.title} unoptimized sizes="40px" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-zinc-100">
                            {item.seriesTitle || item.title}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] text-zinc-500">
                            {item.kind === 'episode'
                              ? `Episode ${item.episodeNumber ?? item.episode ?? ''}`.trim()
                              : 'Seri'}
                          </span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={goToResults}
              className="flex w-full cursor-pointer items-center justify-between gap-2 border-t border-[#2b2222] px-3 py-2.5 text-left text-[12px] font-semibold text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
            >
              Semua hasil untuk “{trimmed}”
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
