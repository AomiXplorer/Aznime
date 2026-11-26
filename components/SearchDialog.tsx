'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Search, X } from 'lucide-react';
import type { QuickSearchItem } from '@/lib/scraper/types';
import { nekopoiCardHref } from '@/lib/nekopoi-links';
import { AnimeImage } from './AnimeImage';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
  /** Di halaman /hentai, pencarian ini juga mencakup katalog Nekopoi. */
  adult?: boolean;
}

function hrefFor(item: QuickSearchItem): string {
  if (item.source === 'nekopoi') return nekopoiCardHref(item);
  if (!item.slug) return '/anime';
  return `${item.kind === 'episode' ? '/watch' : '/anime'}/${encodeURIComponent(item.slug)}`;
}

export function SearchDialog({ open, onClose, adult = false }: SearchDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const reduce = useReducedMotion();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuickSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();

  // Kunci scroll + fokus input saat dibuka.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
    };
  }, [open]);

  useEffect(() => {
    if (!open || trimmed.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?mode=quick&q=${encodeURIComponent(trimmed)}${adult ? '&adult=1' : ''}`,
          { signal: controller.signal }
        );
        const data = (await res.json()) as { results?: QuickSearchItem[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'Pencarian gagal');
        setResults(data.results || []);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Gagal menghubungi server');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, open, adult]);

  const allResultsHref = (value: string) =>
    adult ? `/hentai?q=${encodeURIComponent(value)}` : `/search?q=${encodeURIComponent(value)}`;

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    if (activeIndex >= 0 && results[activeIndex]) {
      navigateTo(hrefFor(results[activeIndex]));
      return;
    }
    navigateTo(allResultsHref(trimmed));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((p) => (results.length === 0 ? -1 : (p + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((p) => (results.length === 0 ? -1 : p <= 0 ? results.length - 1 : p - 1));
    } else if (e.key === 'Tab' && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('input, button, a[href]');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <AnimatePresence onExitComplete={() => setQuery('')}>
      {open ? (
        <motion.div
          key="search-overlay"
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          onKeyDown={handleKeyDown}
        >
          <div
            aria-hidden="true"
            onClick={onClose}
            className="absolute inset-0 bg-black/80"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={adult ? 'Cari hentai' : 'Cari anime'}
            initial={reduce ? false : { opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[10px] border border-white/[0.09] bg-[#131010] shadow-2xl shadow-black/60"
          >
            <form onSubmit={handleSubmit} className="flex items-center gap-3 border-b border-[#241d1d] px-4">
              <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <label htmlFor="quick-search-input" className="sr-only">
                {adult ? 'Judul hentai' : 'Judul anime'}
              </label>
              <input
                ref={inputRef}
                id="quick-search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={adult ? 'Cari judul hentai' : 'Cari judul anime'}
                autoComplete="off"
                className="h-14 flex-1 bg-transparent text-[1.05rem] text-white placeholder:text-zinc-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup pencarian"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
            {!adult && <Link onClick={onClose} href={'/film?q=' + encodeURIComponent(trimmed)} className="block border-b border-line px-4 py-3 text-sm underline">Cari {trimmed ? '“' + trimmed + '” di film' : 'film'}</Link>}

            <div className="max-h-[58vh] overflow-y-auto p-2" aria-live="polite">
              {trimmed.length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  Ketik minimal 2 huruf. Tekan Enter untuk melihat semua hasil.
                </p>
              ) : loading ? (
                <ul aria-label="Memuat hasil" className="space-y-1">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i} className="flex items-center gap-3 rounded-lg p-2">
                      <div className="shimmer h-14 w-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <div className="shimmer h-3.5 w-2/3 rounded" />
                        <div className="shimmer h-3 w-1/3 rounded" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : error ? (
                <p role="alert" className="px-3 py-8 text-center text-sm text-rose-400">
                  {error}
                </p>
              ) : results.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-zinc-300">Tidak ada hasil untuk &ldquo;{trimmed}&rdquo;.</p>
                  <button
                    type="button"
                    onClick={() => navigateTo(allResultsHref(trimmed))}
                    className="mt-3 cursor-pointer text-sm font-semibold text-rose-400 hover:text-rose-300"
                  >
                    Coba pencarian lengkap
                  </button>
                </div>
              ) : (
                <>
                  <ul role="listbox" aria-label="Hasil pencarian cepat" className="space-y-0.5">
                    {results.map((item, idx) => {
                      const isSel = idx === activeIndex;
                      return (
                        <motion.li
                          key={`${item.postId}-${idx}`}
                          role="option"
                          aria-selected={isSel}
                          initial={reduce ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: reduce ? 0 : idx * 0.035, duration: 0.2 }}
                        >
                          <Link
                            href={hrefFor(item)}
                            onClick={onClose}
                            className={`flex items-center gap-3 rounded-lg p-2 transition-colors active:scale-[0.99] ${
                              isSel ? 'bg-white/10' : 'hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-elevated">
                              <AnimeImage
                                src={item.poster}
                                alt={item.title}
                                unoptimized={item.source === 'malz' || item.source === 'nekopoi'}
                                sizes="40px"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                              <p className="mt-0.5 truncate text-xs text-muted">
                                {[item.type, item.genres.slice(0, 3).join(', ')].filter(Boolean).join('  ')}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                  <Link
                    href={allResultsHref(trimmed)}
                    onClick={onClose}
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-rose-400 transition-colors hover:bg-white/[0.05] hover:text-rose-300"
                  >
                    Lihat semua hasil &ldquo;{trimmed}&rdquo;
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
