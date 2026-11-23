'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Play, Youtube } from 'lucide-react';
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

function heroSrc(src: string, width: number, sharpen = false): string {
  return `/api/img?u=${encodeURIComponent(src)}&w=${width}&q=${sharpen ? 78 : 72}&f=webp${sharpen ? '&s=1' : ''}`;
}

/** Poster Hidori punya versi asli tanpa akhiran -215x300. */
function highResPoster(url: string): string {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)hidoristream\.online$/i.test(parsed.hostname)) return url;
    parsed.pathname = parsed.pathname.replace(/-\d+x\d+(\.(?:png|jpe?g|webp))$/i, '$1');
    return parsed.toString();
  } catch {
    return url;
  }
}

export function HeroSection({ items }: HeroSectionProps) {
  const slides = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageHidden, setPageHidden] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeAtRef = useRef(0);

  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

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

  /* Geser banner pakai jari: geser ke kiri lanjut ke slide berikutnya, geser ke
     kanan balik ke sebelumnya. Tombol panah dan titik slide tetap ada. */
  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || slides.length < 2) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipeAtRef.current = Date.now();
      event.preventDefault();
      go(index + (dx < 0 ? 1 : -1));
    }
  };

  if (slides.length === 0) return null;

  const current = slides[index] || slides[0];
  const detailHref = current.slug ? `/anime/${encodeURIComponent(current.slug)}` : '/anime';
  const banner = current.trailer?.bannerImage || null;
  const hasTrailer = Boolean(current.trailer?.id && current.trailer?.site === 'youtube');
  /* AniList tidak selalu mengirim thumbnail, jadi pakai thumbnail YouTube
     bawaan supaya tombol trailer tetap punya gambar. */
  const trailerThumb = hasTrailer
    ? current.trailer?.thumbnail || `https://i.ytimg.com/vi/${current.trailer?.id}/hqdefault.jpg`
    : null;

  return (
    <section
      ref={sectionRef}
      aria-label="Anime unggulan"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClickCapture={(event) => {
        // Setelah geser, jangan sampai tap ikut membuka link yang ada di banner.
        if (Date.now() - swipeAtRef.current < 400) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className="relative -mt-16 w-full touch-pan-y overflow-hidden bg-canvas"
    >
      <div className="absolute inset-0" aria-hidden="true">
        <div key={`bg-${index}`} className="absolute inset-0">
          {banner ? (
            <img
              src={heroSrc(banner, 1280)}
              srcSet={`${heroSrc(banner, 640)} 640w, ${heroSrc(banner, 960)} 960w, ${heroSrc(banner, 1280)} 1280w, ${heroSrc(banner, 1600)} 1600w`}
              sizes="100vw"
              alt=""
              fetchPriority={index === 0 ? 'high' : 'auto'}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
          ) : current.poster ? (
            <img
              src={heroSrc(highResPoster(current.poster), 900, true)}
              onError={(event) => {
                const img = event.currentTarget;
                if (img.dataset.fallback) return;
                img.dataset.fallback = '1';
                img.src = heroSrc(current.poster!, 800, true);
              }}
              alt=""
              fetchPriority={index === 0 ? 'high' : 'auto'}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div className="h-full w-full bg-[#0c0908]" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[68vh] max-w-7xl items-end gap-10 px-4 pb-20 pt-32 sm:px-6 lg:min-h-[78vh] lg:px-8">
        <div key={`txt-${index}`} className="max-w-xl flex-1 space-y-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-zinc-300">
              {current.status ? (
                <span className="rounded-[3px] bg-accent px-1.5 py-[3px] text-[11px] font-semibold leading-none text-white">{current.status}</span>
              ) : null}
              {current.releaseYear ? <span>{current.releaseYear}</span> : null}
              {current.type ? <span>{current.type}</span> : null}
              {current.genres.length > 0 ? <span>{current.genres.slice(0, 3).join(', ')}</span> : null}
            </div>

            <h1 className="line-clamp-3 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.035em] text-white [text-wrap:balance] sm:text-[38px] lg:text-[46px]">
              {current.title}
            </h1>

            {current.synopsis ? (
              <p className="line-clamp-3 max-w-prose text-sm leading-relaxed text-zinc-300">{current.synopsis}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
              <Link
                href={detailHref}
                className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-white px-5 text-[13px] font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Tonton
              </Link>
              {hasTrailer ? (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  aria-label={`Putar trailer ${current.title}`}
                  className="group inline-flex h-11 cursor-pointer items-center gap-2.5 pr-1 text-[13px] font-medium text-zinc-300 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span className="relative h-11 w-[78px] shrink-0 overflow-hidden rounded-[4px] ring-1 ring-white/20">
                    <AnimeImage
                      src={trailerThumb}
                      alt=""
                      sizes="78px"
                      className="object-cover object-center"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/35 transition-colors duration-150 group-hover:bg-black/20">
                      <Play className="h-3.5 w-3.5 fill-current text-white" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Youtube className="h-4 w-4" aria-hidden="true" />
                    Trailer
                  </span>
                </button>
              ) : null}
            </div>
        </div>

        {current.poster ? (
          <Link
            href={detailHref}
            tabIndex={-1}
            aria-hidden="true"
            className="relative ml-auto hidden aspect-[2/3] w-[200px] shrink-0 overflow-hidden rounded-[6px] shadow-2xl shadow-black/50 ring-1 ring-white/15 lg:block"
          >
            <img
              src={heroSrc(highResPoster(current.poster), 400)}
              srcSet={`${heroSrc(highResPoster(current.poster), 200)} 200w, ${heroSrc(highResPoster(current.poster), 400)} 400w`}
              sizes="200px"
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onError={(event) => {
                const img = event.currentTarget;
                if (img.dataset.fallback) return;
                img.dataset.fallback = '1';
                img.src = heroSrc(current.poster!, 400);
              }}
              className="h-full w-full object-cover"
            />
          </Link>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-6 z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3" role="tablist" aria-label="Pilih anime unggulan">
              <span className="font-display text-[12px] tabular-nums text-zinc-200">
                {String(index + 1).padStart(2, '0')}
                <span className="text-zinc-500"> / {String(slides.length).padStart(2, '0')}</span>
              </span>
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
                  <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden bg-white/25 transition-colors group-hover:bg-white/45 group-focus-visible:ring-2 group-focus-visible:ring-white">
                    {i === index ? (
                      <span
                        key={`bar-${index}`}
                        /* Autoplay dijalankan oleh CSS animation di compositor:
                           tidak ada setInterval/setTimeout yang membangunkan
                           main thread, dan progres otomatis berhenti saat hover. */
                        onAnimationEnd={autoplay ? () => go(index + 1) : undefined}
                        className="block h-full origin-left bg-accent"
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
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[4px] bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Anime unggulan berikutnya"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[4px] bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
