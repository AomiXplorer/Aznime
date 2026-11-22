'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Info, Play, Youtube } from 'lucide-react';
import type { AniListTrailer, FeaturedAnime } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';
import { AnimeImage } from './AnimeImage';
import { TrailerModal } from './TrailerModal';

interface FeaturedWithTrailer extends FeaturedAnime {
  trailer?: AniListTrailer | null;
}

interface HeroSectionProps {
  items: FeaturedWithTrailer[];
}

const AUTOPLAY_MS = 8000;
const SWIPE_THRESHOLD_PX = 45;

export function HeroSection({ items }: HeroSectionProps) {
  const slides = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  // Slide pertama harus langsung terlihat saat paint awal agar LCP tidak tertunda.
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
  const showcasePoster = current.trailer?.coverImage || current.poster;
  const hasTrailer = Boolean(current.trailer?.id && current.trailer?.site === 'youtube');

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    suppressClickRef.current = false;
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || slides.length <= 1) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      suppressClickRef.current = true;
      go(dx < 0 ? index + 1 : index - 1);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 150);
    }
  };

  const cancelSwipe = () => {
    swipeStartRef.current = null;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (slides.length <= 1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Anime unggulan"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onKeyDown={handleKeyDown}
      className="relative -mt-16 w-full overflow-hidden bg-canvas"
    >
      {/* Satu wrapper AnimatePresence terpadu untuk latar dan konten agar tidak pernah desync saat klik/geser cepat. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelSwipe}
        onPointerLeave={cancelSwipe}
        onClickCapture={(e) => {
          if (suppressClickRef.current) e.preventDefault();
        }}
        className="relative touch-pan-y select-none"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={current.slug || index}
            initial={isFirstPaint.current || reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
            className="relative"
          >
            {/* Latar panggung adaptif: widescreen banner bila tersedia, atau Split Stage tekstur + ambient crimson glow bila hanya ada poster portrait. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {banner ? (
                <>
                  <AnimeImage
                    src={banner}
                    alt=""
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/75 to-canvas/20" />
                  <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-canvas via-canvas/55 to-transparent" />
                </>
              ) : (
                <>
                  <div className="stage-pattern absolute inset-0 opacity-60" />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(circle at 76% 38%, rgba(225, 29, 72, 0.14), transparent 56%)',
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent" />
                </>
              )}
            </div>

            <div className="relative mx-auto flex min-h-[68vh] max-w-7xl flex-col-reverse justify-end gap-6 px-4 pb-32 pt-28 sm:flex-row sm:items-end sm:justify-between sm:gap-10 sm:px-6 sm:pb-36 lg:min-h-[76vh] lg:px-8">
              <div className="max-w-xl flex-1 space-y-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
                  {current.status ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-ink">
                      <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-accent" />
                      {current.status}
                    </span>
                  ) : null}
                  {current.releaseYear ? (
                    <span className="font-mono text-xs tabular-nums">{current.releaseYear}</span>
                  ) : null}
                  {current.type ? <span>{current.type}</span> : null}
                  {current.genres.length > 0 ? (
                    <span className="text-muted">{current.genres.slice(0, 3).join(' · ')}</span>
                  ) : null}
                </div>

                <h1 className="line-clamp-3 font-display text-[2rem] font-bold leading-[1.06] text-ink [text-wrap:balance] sm:text-[2.65rem] lg:text-[3.25rem]">
                  {current.title}
                </h1>

                {current.synopsis ? (
                  <p className="line-clamp-3 max-w-prose text-sm leading-relaxed text-muted">
                    {current.synopsis}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
                  <Link
                    href={detailHref}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-white transition-colors duration-150 hover:bg-accent-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    Tonton
                  </Link>
                  <Link
                    href={detailHref}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface/80 px-5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-white/25 hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                    Info lainnya
                  </Link>
                  {hasTrailer ? (
                    <button
                      type="button"
                      onClick={() => setTrailerOpen(true)}
                      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-muted transition-colors hover:bg-surface/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
                    >
                      <Youtube className="h-4 w-4 text-accent-ink" aria-hidden="true" />
                      Trailer
                    </button>
                  ) : null}
                </div>
              </div>

              {!banner && showcasePoster ? (
                <Link
                  href={detailHref}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative aspect-[2/3] w-[144px] shrink-0 overflow-hidden rounded-2xl bg-surface shadow-[0_24px_60px_-15px_rgba(225,29,72,0.25)] ring-1 ring-white/15 sm:w-[184px] lg:w-[232px]"
                >
                  <AnimeImage
                    src={showcasePoster}
                    alt={current.title}
                    priority
                    sizes="(max-width: 640px) 144px, (max-width: 1024px) 184px, 232px"
                  />
                </Link>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Interactive Filmstrip Dock */}
      {slides.length > 1 ? (
        <div className="relative z-10 -mt-20 pb-6 sm:-mt-24">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div
              role="tablist"
              aria-label="Pilih anime unggulan"
              className="grid flex-1 grid-cols-6 gap-1.5 sm:gap-2.5"
            >
              {slides.map((item, i) => {
                const isActive = i === index;
                const thumbSrc = item.trailer?.coverImage || item.poster;
                const slideNum = String(i + 1).padStart(2, '0');
                return (
                  <button
                    key={item.slug || i}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Unggulan ${i + 1}: ${item.title}`}
                    onClick={() => go(i)}
                    className={cn(
                      'group relative flex h-11 cursor-pointer items-center justify-center gap-1 overflow-hidden rounded-xl border px-1.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink sm:h-14 sm:justify-start sm:gap-2.5 sm:px-2',
                      isActive
                        ? 'border-accent/60 bg-elevated/95 text-ink'
                        : 'border-line bg-surface/80 text-muted hover:border-white/20 hover:bg-elevated/80 hover:text-ink'
                    )}
                  >
                    <span className="relative h-7 w-5 shrink-0 overflow-hidden rounded-md bg-canvas ring-1 ring-white/10 sm:h-10 sm:w-7">
                      <AnimeImage src={thumbSrc} alt="" sizes="36px" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block font-mono text-[10px] font-bold leading-none tabular-nums sm:text-[11px]',
                          isActive ? 'text-accent-ink' : 'text-faint group-hover:text-muted'
                        )}
                      >
                        {slideNum}
                      </span>
                      <span className="mt-1 hidden truncate text-xs font-semibold leading-tight sm:block">
                        {item.title}
                      </span>
                    </div>

                    {isActive ? (
                      <span
                        key={`bar-${index}`}
                        onAnimationEnd={autoplay ? () => go(index + 1) : undefined}
                        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent-hover"
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
                  </button>
                );
              })}
            </div>

            <div className="hidden shrink-0 items-center gap-1.5 md:flex">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Anime unggulan sebelumnya"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-surface/90 text-ink transition-colors hover:border-accent/50 hover:bg-accent hover:text-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Anime unggulan berikutnya"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-line bg-surface/90 text-ink transition-colors hover:border-accent/50 hover:bg-accent hover:text-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
