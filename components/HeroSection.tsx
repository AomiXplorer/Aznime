'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Info, Play, Youtube } from 'lucide-react';
import type { AniListTrailer, FeaturedAnime } from '@/lib/scraper/types';
import { AnimeImage } from './AnimeImage';
import { TrailerModal } from './TrailerModal';

interface FeaturedWithTrailer extends FeaturedAnime {
  trailer?: AniListTrailer | null;
}

interface HeroSectionProps {
  items: FeaturedWithTrailer[];
}

const AUTOPLAY_MS = 8000;

export function HeroSection({ items }: HeroSectionProps) {
  const slides = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  /* Slide pertama harus langsung terlihat. Sebelumnya gambar hero memulai dari
     opacity 0 lalu dianimasikan setelah hydration, sehingga Largest Contentful
     Paint tertunda sampai JS selesai (~3,2 s di mobile). Sekarang fade-in hanya
     berlaku untuk pergantian slide, bukan untuk paint pertama. */
  const isFirstPaint = useRef(true);
  useEffect(() => {
    isFirstPaint.current = false;
  }, []);
  const reduce = useReducedMotion();

  const go = useCallback(
    (n: number) => {
      if (slides.length === 0) return;
      setIndex(((n % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  /* Autoplay berhenti saat hero keluar layar atau tab disembunyikan. Pergantian
     banner besar yang terus jalan di latar belakang bikin scroll di HP tersendat. */
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const autoplay = !reduce && slides.length > 1 && inView && !pageHidden;
  const paused = hovered || trailerOpen;

  if (slides.length === 0) return null;

  const current = slides[index] || slides[0];
  const detailHref = current.slug ? `/anime/${encodeURIComponent(current.slug)}` : '/anime';
  const banner = current.trailer?.bannerImage || null;
  const hasTrailer = Boolean(current.trailer?.id && current.trailer?.site === 'youtube');

  return (
    <section
      ref={sectionRef}
      aria-label="Anime unggulan"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="relative -mt-16 w-full overflow-hidden bg-canvas"
    >
      <div className="absolute inset-0" aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.div
            key={`bg-${index}`}
            className="absolute inset-0"
            /* Hanya opacity: animasi scale pada gambar selebar viewport
               memaksa rasterisasi ulang layer besar tiap frame. */
            initial={isFirstPaint.current || reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.45, ease: 'easeOut' }}
          >
            {banner ? (
              <AnimeImage src={banner} alt="" priority sizes="100vw" className="object-cover object-center" />
            ) : (
              /* Tanpa filter blur: blur 2xl pada gambar selebar layar adalah
                 salah satu operasi paint termahal dan selalu aktif. */
              <AnimeImage
                src={current.poster}
                alt=""
                priority
                sizes="100vw"
                className="object-cover object-top opacity-30"
              />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[68vh] max-w-7xl items-end gap-10 px-4 pb-20 pt-32 sm:px-6 lg:min-h-[78vh] lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`txt-${index}`}
            initial={isFirstPaint.current || reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="max-w-xl flex-1 space-y-3.5"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
              {current.status ? (
                <span className="flex items-center gap-2 font-bold text-ink">
                  <span aria-hidden="true" className="h-3.5 w-0.5 bg-accent" />
                  {current.status}
                </span>
              ) : null}
              {current.releaseYear ? <span>{current.releaseYear}</span> : null}
              {current.type ? <span>{current.type}</span> : null}
              {current.genres.length > 0 ? <span>{current.genres.slice(0, 3).join(', ')}</span> : null}
            </div>

            <h1 className="line-clamp-3 font-display text-[2.1rem] font-bold leading-[1.05] text-ink [text-wrap:balance] sm:text-[2.7rem] lg:text-[3.3rem]">
              {current.title}
            </h1>

            {current.synopsis ? (
              <p className="line-clamp-3 max-w-prose text-sm leading-relaxed text-muted">{current.synopsis}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
              <Link
                href={detailHref}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-bold text-white transition-colors duration-150 hover:bg-accent-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Tonton
              </Link>
              <Link
                href={detailHref}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/25 px-5 text-sm font-bold text-ink transition-colors duration-150 hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
                Info lainnya
              </Link>
              {hasTrailer ? (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                >
                  <Youtube className="h-4 w-4" aria-hidden="true" />
                  Trailer
                </button>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {!banner ? (
          <Link
            href={detailHref}
            tabIndex={-1}
            aria-hidden="true"
            className="relative ml-auto hidden aspect-[2/3] w-[210px] shrink-0 overflow-hidden rounded shadow-xl shadow-black/60 ring-1 ring-white/10 lg:block"
          >
            <AnimeImage src={current.poster} alt={current.title} priority sizes="210px" />
          </Link>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-6 z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2" role="tablist" aria-label="Pilih anime unggulan">
              {slides.map((item, i) => (
                <button
                  key={item.slug || i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Unggulan ${i + 1}: ${item.title}`}
                  onClick={() => go(i)}
                  className="group relative h-6 w-9 cursor-pointer focus-visible:outline-none sm:w-12"
                >
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden bg-white/25 transition-colors group-hover:bg-white/40 group-focus-visible:ring-2 group-focus-visible:ring-accent-ink">
                    {i === index ? (
                      <span
                        key={`bar-${index}`}
                        /* Autoplay dijalankan oleh CSS animation di compositor:
                           tidak ada setInterval/setTimeout yang membangunkan
                           main thread, dan progres otomatis berhenti saat hover. */
                        onAnimationEnd={autoplay ? () => go(index + 1) : undefined}
                        className="block h-full origin-left bg-accent-hover"
                        style={
                          autoplay
                            ? {
                                animation: `hero-progress ${AUTOPLAY_MS}ms linear forwards`,
                                animationPlayState: paused ? 'paused' : 'running',
                              }
                            : undefined
                        }
                      />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Anime unggulan sebelumnya"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-line bg-canvas/70 text-ink transition-colors hover:bg-elevated active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Anime unggulan berikutnya"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-line bg-canvas/70 text-ink transition-colors hover:bg-elevated active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TrailerModal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        title={current.title}
        trailer={current.trailer || null}
      />
    </section>
  );
}
