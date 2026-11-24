'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  Ref,
  RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  FastForward,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { cleanEpisodeTitle } from '@/lib/episode-format';
import { clamp, formatClock, safeStorage, spokenClock } from './format';

export interface QualityControl {
  options: { index: number; label: string }[];
  /** -1 = otomatis. */
  current: number;
  onSelect: (index: number) => void;
}

export interface EpisodeTarget {
  href: string;
  label: string;
}

interface DirectControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  title: string;
  seriesTitle?: string | null;
  /** Server masih memuat; spinner buffering ditahan supaya tidak dobel. */
  loading: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  next: EpisodeTarget | null;
  prev: EpisodeTarget | null;
  quality: QualityControl | null;
  /** Kunci unik episode untuk menyimpan posisi terakhir. */
  storageKey: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
/** Panjang standar opening anime; tombol "Lompat 85 dtk". */
const SKIP_SECONDS = 85;
const HIDE_AFTER_MS = 2800;
const NEXT_COUNTDOWN = 8;
const VOLUME_KEY = 'aznime:volume';
const AUTONEXT_KEY = 'aznime:autonext';
const AUTOPLAY_FLAG = 'aznime:autoplay';
const RESUME_PREFIX = 'aznime:pos:';

type FlashSide = 'l' | 'c' | 'r';

/** Ujung buffer yang mencakup posisi putar saat ini. */
function bufferedEndAt(video: HTMLVideoElement): number {
  const t = video.currentTime;
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i += 1) {
    if (ranges.start(i) <= t + 0.25 && ranges.end(i) >= t) return ranges.end(i);
  }
  return t;
}

interface BarButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

function BarButton({ label, onClick, children, pressed, className, ref }: BarButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        'inline-flex h-9 min-w-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-1.5 text-white transition-colors duration-150 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        pressed && 'bg-white/[0.14]',
        className
      )}
    >
      {children}
    </button>
  );
}

export function DirectControls({
  videoRef,
  title,
  seriesTitle,
  loading,
  isFullscreen,
  onToggleFullscreen,
  next,
  prev,
  quality,
  storageKey,
}: DirectControlsProps) {
  const router = useRouter();
  const resumeKey = `${RESUME_PREFIX}${storageKey}`;

  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [pipOk, setPipOk] = useState(false);

  const [visible, setVisible] = useState(true);
  const [focusWithin, setFocusWithin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ id: number; text: string; side: FlashSide } | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [autoNext, setAutoNext] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);
  const tapTimer = useRef<number | undefined>(undefined);
  const lastTap = useRef<number>(0);
  const pointerType = useRef<string>('mouse');
  const resumeApplied = useRef(false);
  const lastSave = useRef(0);
  const navigating = useRef(false);
  const showBarRef = useRef(true);

  const showBar = visible || paused || menuOpen || scrub !== null || focusWithin || ended;
  showBarRef.current = showBar;

  /* ---------- helpers ---------- */

  const poke = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS);
  }, []);

  const showFlash = useCallback((text: string, side: FlashSide) => {
    window.clearTimeout(flashTimer.current);
    setFlash({ id: Date.now(), text, side });
    flashTimer.current = window.setTimeout(() => setFlash(null), 700);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void video.play().catch(() => undefined);
    else video.pause();
  }, [videoRef]);

  const seekBy = useCallback(
    (delta: number, side: FlashSide) => {
      const video = videoRef.current;
      if (!video) return;
      const max = Number.isFinite(video.duration) ? video.duration : Infinity;
      video.currentTime = clamp(video.currentTime + delta, 0, max);
      showFlash(`${delta > 0 ? '+' : '−'}${Math.abs(delta)} dtk`, side);
    },
    [videoRef, showFlash]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.5;
  }, [videoRef]);

  const changeVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = clamp(value, 0, 1);
      video.muted = value <= 0;
    },
    [videoRef]
  );

  const changeRate = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (video) video.playbackRate = value;
    },
    [videoRef]
  );

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* PiP ditolak browser; abaikan. */
    }
  }, [videoRef]);

  const goNext = useCallback(() => {
    if (!next) return;
    try {
      window.sessionStorage.setItem(AUTOPLAY_FLAG, '1');
    } catch {
      /* abaikan */
    }
    router.push(next.href);
  }, [next, router]);

  const restartFromBeginning = () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    safeStorage.remove(resumeKey);
    setResumeFrom(null);
  };

  const toggleAutoNext = () => {
    setAutoNext((value) => {
      safeStorage.set(AUTONEXT_KEY, value ? '0' : '1');
      return !value;
    });
  };

  /* ---------- sinkronisasi dengan elemen <video> ---------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Terapkan volume terakhir yang dipakai penonton.
    const stored = safeStorage.get(VOLUME_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { v?: unknown; m?: unknown };
        if (typeof parsed.v === 'number') video.volume = clamp(parsed.v, 0, 1);
        if (typeof parsed.m === 'boolean') video.muted = parsed.m;
      } catch {
        /* data rusak; pakai default */
      }
    }

    let autoplayPending = false;
    try {
      if (window.sessionStorage.getItem(AUTOPLAY_FLAG) === '1') {
        window.sessionStorage.removeItem(AUTOPLAY_FLAG);
        autoplayPending = true;
      }
    } catch {
      /* abaikan */
    }

    const finiteDuration = () => (Number.isFinite(video.duration) ? video.duration : 0);

    const saveProgress = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastSave.current < 4000) return;
      const d = finiteDuration();
      if (!d || video.currentTime < 5 || video.ended) return;
      lastSave.current = now;
      if (d - video.currentTime < 45) safeStorage.remove(resumeKey);
      else safeStorage.set(resumeKey, String(Math.floor(video.currentTime)));
    };

    const tryResume = () => {
      const d = finiteDuration();
      if (resumeApplied.current || d <= 0) return;
      resumeApplied.current = true;
      const saved = Number(safeStorage.get(resumeKey));
      if (Number.isFinite(saved) && saved > 20 && d - saved > 45) {
        video.currentTime = saved;
        setResumeFrom(saved);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(finiteDuration());
      tryResume();
    };
    const onDuration = () => {
      setDuration(finiteDuration());
      tryResume();
    };
    const onTime = () => {
      setTime(video.currentTime);
      setBufferedEnd(bufferedEndAt(video));
      saveProgress(false);
    };
    const onProgress = () => setBufferedEnd(bufferedEndAt(video));
    const onPlay = () => {
      setPaused(false);
      setEnded(false);
      setDismissed(false);
      poke();
    };
    const onPlaying = () => {
      setStarted(true);
      setBuffering(false);
      setPaused(false);
    };
    const onPause = () => {
      setPaused(true);
      saveProgress(true);
    };
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => {
      setBuffering(false);
      if (autoplayPending) {
        autoplayPending = false;
        void video.play().catch(() => undefined);
      }
    };
    const onEnded = () => {
      setEnded(true);
      setPaused(true);
      safeStorage.remove(resumeKey);
    };
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
      safeStorage.set(VOLUME_KEY, JSON.stringify({ v: video.volume, m: video.muted }));
    };
    const onRate = () => setRate(video.playbackRate);

    const listeners: [string, () => void][] = [
      ['loadedmetadata', onLoadedMetadata],
      ['durationchange', onDuration],
      ['timeupdate', onTime],
      ['progress', onProgress],
      ['seeked', onTime],
      ['play', onPlay],
      ['playing', onPlaying],
      ['pause', onPause],
      ['waiting', onWaiting],
      ['canplay', onCanPlay],
      ['ended', onEnded],
      ['volumechange', onVolume],
      ['ratechange', onRate],
    ];
    listeners.forEach(([name, fn]) => video.addEventListener(name, fn));

    // Keadaan awal, kalau video sudah sempat memuat sebelum listener terpasang.
    setPaused(video.paused);
    setEnded(video.ended);
    setVolume(video.volume);
    setMuted(video.muted);
    setRate(video.playbackRate);
    setTime(video.currentTime || 0);
    setDuration(finiteDuration());
    if (video.readyState >= 1) tryResume();

    return () => {
      listeners.forEach(([name, fn]) => video.removeEventListener(name, fn));
    };
  }, [videoRef, resumeKey, poke]);

  useEffect(() => {
    setPipOk(Boolean(document.pictureInPictureEnabled));
    if (safeStorage.get(AUTONEXT_KEY) === '0') setAutoNext(false);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(flashTimer.current);
      window.clearTimeout(tapTimer.current);
    },
    []
  );

  /* ---------- hitung mundur episode berikutnya ---------- */

  useEffect(() => {
    if (!ended || !next || !autoNext || dismissed) {
      setCount(null);
      return;
    }
    setCount(NEXT_COUNTDOWN);
    const id = window.setInterval(() => setCount((c) => (c === null ? c : c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [ended, next, autoNext, dismissed]);

  useEffect(() => {
    if (count !== null && count <= 0 && !navigating.current) {
      navigating.current = true;
      goNext();
    }
  }, [count, goNext]);

  /* ---------- pemberitahuan resume hilang sendiri ---------- */

  useEffect(() => {
    if (resumeFrom === null) return;
    const id = window.setTimeout(() => setResumeFrom(null), 7000);
    return () => window.clearTimeout(id);
  }, [resumeFrom]);

  /* ---------- menu pengaturan: klik di luar + Esc ---------- */

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuBtnRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Jangan ikut menutup mode theater di belakangnya.
      e.stopPropagation();
      setMenuOpen(false);
      menuBtnRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [menuOpen]);

  /* ---------- pintasan keyboard ---------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key;
      const onControl = target?.closest('button, a, [role="slider"], [role="switch"]');
      // Spasi/Enter pada tombol atau tautan yang sedang fokus = klik biasa.
      if (onControl && (key === ' ' || key === 'Enter')) return;
      // Slider seek mengurus panah dan Home/End sendiri.
      if (
        target?.closest('[role="slider"]') &&
        ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      const k = key.toLowerCase();

      if (key === ' ' || k === 'k') {
        e.preventDefault();
        togglePlay();
        poke();
      } else if (k === 'm') {
        e.preventDefault();
        toggleMute();
        poke();
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        seekBy(5, 'r');
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        seekBy(-5, 'l');
      } else if (k === 'l') {
        e.preventDefault();
        seekBy(10, 'r');
      } else if (k === 'j') {
        e.preventDefault();
        seekBy(-10, 'l');
      } else if (/^[0-9]$/.test(key) && Number.isFinite(video.duration)) {
        e.preventDefault();
        video.currentTime = (video.duration * Number(key)) / 10;
        poke();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [videoRef, togglePlay, toggleMute, seekBy, poke]);

  /* ---------- kontrol media di layar kunci / headset ---------- */

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.metadata = new MediaMetadata({ title, artist: seriesTitle || 'Aznime' });
    } catch {
      /* browser tidak mendukung metadata */
    }
    const actions: MediaSessionAction[] = [
      'play',
      'pause',
      'seekbackward',
      'seekforward',
      'seekto',
      'nexttrack',
      'previoustrack',
    ];
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* aksi tidak didukung */
      }
    };
    set('play', () => void videoRef.current?.play().catch(() => undefined));
    set('pause', () => videoRef.current?.pause());
    set('seekbackward', (d) => seekBy(-(d.seekOffset ?? 10), 'l'));
    set('seekforward', (d) => seekBy(d.seekOffset ?? 10, 'r'));
    set('seekto', (d) => {
      const video = videoRef.current;
      if (video && typeof d.seekTime === 'number') video.currentTime = d.seekTime;
    });
    set('nexttrack', next ? goNext : null);
    set('previoustrack', prev ? () => router.push(prev.href) : null);
    return () => {
      actions.forEach((action) => set(action, null));
      try {
        session.metadata = null;
      } catch {
        /* abaikan */
      }
    };
  }, [videoRef, title, seriesTitle, next, prev, goNext, seekBy, router]);

  /* ---------- gestur pada layar video ---------- */

  const onSurfacePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerType.current = e.pointerType;
  };

  const onSurfacePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const now = Date.now();

    if (now - lastTap.current < 300) {
      // Ketuk dua kali: kiri mundur, kanan maju, tengah putar/jeda.
      lastTap.current = 0;
      window.clearTimeout(tapTimer.current);
      if (x < 0.34) seekBy(-10, 'l');
      else if (x > 0.66) seekBy(10, 'r');
      else togglePlay();
      return;
    }

    lastTap.current = now;
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      // Ketuk sekali: tampilkan atau sembunyikan kontrol.
      if (showBarRef.current && !videoRef.current?.paused) {
        window.clearTimeout(hideTimer.current);
        setVisible(false);
        setFocusWithin(false);
      } else {
        poke();
      }
    }, 300);
  };

  const onSurfaceClick = () => {
    if (pointerType.current !== 'mouse') return;
    setMenuOpen(false);
    togglePlay();
  };

  const onSurfaceDoubleClick = () => {
    if (pointerType.current !== 'mouse') return;
    onToggleFullscreen();
  };

  /* ---------- seek bar ---------- */

  const ratioFromEvent = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp((e.clientX - rect.left) / rect.width, 0, 1);
  };

  const onSeekPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(ratioFromEvent(e));
  };

  const onSeekPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ratio = ratioFromEvent(e);
    setHover(ratio);
    if (scrub !== null) setScrub(ratio);
  };

  const onSeekPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub === null) return;
    const video = videoRef.current;
    if (video && duration) video.currentTime = ratioFromEvent(e) * duration;
    setScrub(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onSeekKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    let target: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = video.currentTime + 5;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = video.currentTime - 5;
    else if (e.key === 'PageUp') target = video.currentTime + 30;
    else if (e.key === 'PageDown') target = video.currentTime - 30;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = duration;
    if (target === null) return;
    e.preventDefault();
    video.currentTime = clamp(target, 0, duration);
  };

  /* ---------- tampilan ---------- */

  const progress = scrub ?? (duration ? clamp(time / duration, 0, 1) : 0);
  const buffered = duration ? clamp(bufferedEnd / duration, 0, 1) : 0;
  const shownTime = scrub !== null ? scrub * duration : time;
  const tooltipRatio = scrub ?? hover;
  const effectiveVolume = muted ? 0 : volume;
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2;
  const playLabel = ended ? 'Putar ulang' : paused ? 'Putar' : 'Jeda';
  const PlayIcon = ended ? RotateCcw : paused ? Play : Pause;

  return (
    <div
      className={cn('absolute inset-0 select-none', !showBar && !paused && 'cursor-none')}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') poke();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => setVisible(false), 700);
      }}
    >
      {/* Permukaan gestur: klik = putar/jeda, ketuk dua kali = lompat. */}
      <div
        className="absolute inset-0 touch-manipulation"
        onPointerDown={onSurfacePointerDown}
        onPointerUp={onSurfacePointerUp}
        onClick={onSurfaceClick}
        onDoubleClick={onSurfaceDoubleClick}
      />

      {isFullscreen ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent px-4 pb-10 pt-4 transition-opacity duration-200',
            showBar ? 'opacity-100' : 'opacity-0'
          )}
        >
          <p className="truncate text-[15px] font-semibold text-white">{cleanEpisodeTitle(title)}</p>
        </div>
      ) : null}

      {!started && paused && !loading ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Putar video"
          className="absolute left-1/2 top-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-accent text-white transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Play className="ml-0.5 size-7 fill-current" aria-hidden="true" />
        </button>
      ) : null}

      {buffering && !loading && !paused ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Loader2
            className="size-9 animate-spin text-white/90 motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
      ) : null}

      {flash ? (
        <div
          key={flash.id}
          aria-hidden="true"
          className={cn(
            'player-flash pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3.5 py-1.5 text-[13px] font-semibold tabular-nums text-white',
            flash.side === 'l' && 'left-[12%]',
            flash.side === 'r' && 'right-[12%]',
            flash.side === 'c' && 'left-1/2 -translate-x-1/2'
          )}
        >
          {flash.text}
        </div>
      ) : null}

      {resumeFrom !== null ? (
        <div
          role="status"
          className="absolute bottom-[4.75rem] left-3 flex items-center gap-3 rounded-lg bg-surface px-3 py-2 text-[12.5px] text-zinc-300 ring-1 ring-white/10"
        >
          <span>
            Dilanjutkan dari{' '}
            <span className="font-medium tabular-nums text-white">{formatClock(resumeFrom)}</span>
          </span>
          <button
            type="button"
            onClick={restartFromBeginning}
            className="cursor-pointer font-semibold text-white underline decoration-white/30 underline-offset-2 transition-colors hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Mulai dari awal
          </button>
        </div>
      ) : null}

      {count !== null && next ? (
        <div className="absolute bottom-[4.75rem] right-3 w-64 overflow-hidden rounded-lg bg-surface ring-1 ring-white/10">
          <span className="sr-only" role="status">
            Episode berikutnya diputar dalam {NEXT_COUNTDOWN} detik: {next.label}
          </span>
          <div className="p-3">
            <p className="text-[12px] text-zinc-400" aria-hidden="true">
              Mulai dalam {Math.max(count, 0)} detik
            </p>
            <p className="mt-0.5 truncate text-[14px] font-semibold text-white">{next.label}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={goNext}
                className="inline-flex h-8 flex-1 cursor-pointer items-center justify-center rounded-md bg-white text-[12.5px] font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Putar sekarang
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-[12.5px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Batal
              </button>
            </div>
          </div>
          <div className="h-[3px] bg-white/10" aria-hidden="true">
            <div className="player-countdown h-full bg-accent" />
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Pengaturan pemutar"
          className="absolute bottom-[4.5rem] right-2 max-h-[calc(100%-5.5rem)] w-60 overflow-y-auto rounded-lg bg-surface p-3 ring-1 ring-white/10 sm:right-3"
        >
          <p className="mb-1.5 text-[12px] text-zinc-400">Kecepatan</p>
          <div className="flex flex-wrap gap-1">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                aria-pressed={rate === speed}
                onClick={() => changeRate(speed)}
                className={cn(
                  'h-7 min-w-11 cursor-pointer rounded-md px-2 text-[12px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                  rate === speed
                    ? 'bg-white text-black'
                    : 'bg-white/[0.07] text-zinc-200 hover:bg-white/[0.13]'
                )}
              >
                {speed === 1 ? 'Normal' : `${speed}×`}
              </button>
            ))}
          </div>

          {quality && quality.options.length > 1 ? (
            <>
              <p className="mb-1.5 mt-3.5 text-[12px] text-zinc-400">Kualitas</p>
              <div className="flex flex-wrap gap-1">
                {[{ index: -1, label: 'Otomatis' }, ...quality.options].map((option) => (
                  <button
                    key={option.index}
                    type="button"
                    aria-pressed={quality.current === option.index}
                    onClick={() => quality.onSelect(option.index)}
                    className={cn(
                      'h-7 min-w-11 cursor-pointer rounded-md px-2 text-[12px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                      quality.current === option.index
                        ? 'bg-white text-black'
                        : 'bg-white/[0.07] text-zinc-200 hover:bg-white/[0.13]'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {next ? (
            <button
              type="button"
              role="switch"
              aria-checked={autoNext}
              onClick={toggleAutoNext}
              className="mt-3.5 flex w-full cursor-pointer items-center justify-between gap-3 rounded-md text-left text-[12.5px] text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span>Putar episode berikutnya otomatis</span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                  autoNext ? 'bg-accent' : 'bg-white/20'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-4 rounded-full bg-white transition-[left]',
                    autoNext ? 'left-[1.125rem]' : 'left-0.5'
                  )}
                />
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Bilah kontrol */}
      <div
        onPointerDown={poke}
        onFocusCapture={(e) => {
          if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) {
            setFocusWithin(true);
          }
        }}
        onBlurCapture={() => setFocusWithin(false)}
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-12 transition-opacity duration-200 sm:px-3.5',
          showBar ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Posisi pemutaran"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(shownTime)}
          aria-valuetext={`${spokenClock(shownTime)} dari ${spokenClock(duration)}`}
          onPointerDown={onSeekPointerDown}
          onPointerMove={onSeekPointerMove}
          onPointerUp={onSeekPointerUp}
          onPointerCancel={() => setScrub(null)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onSeekKeyDown}
          className="group/seek relative h-5 cursor-pointer touch-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <div
            ref={trackRef}
            className={cn(
              'absolute inset-x-0 top-1/2 -translate-y-1/2 bg-white/[0.18] transition-[height] duration-150 group-hover/seek:h-[5px] group-focus-visible/seek:h-[5px]',
              scrub !== null ? 'h-[5px]' : 'h-[3px]'
            )}
          >
            <div
              className="absolute inset-0 origin-left bg-white/[0.28]"
              style={{ transform: `scaleX(${buffered})` }}
            />
            <div
              className={cn(
                'absolute inset-0 origin-left bg-accent',
                scrub === null && 'transition-transform duration-300 ease-linear'
              )}
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          <div
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-transform duration-150 group-hover/seek:scale-100 group-focus-visible/seek:scale-100',
              scrub !== null ? 'scale-100' : 'scale-0'
            )}
            style={{ left: `${progress * 100}%` }}
          />
          {tooltipRatio !== null && duration > 0 ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-1 text-[12px] font-medium tabular-nums text-white"
              style={{ left: `clamp(1.75rem, ${tooltipRatio * 100}%, calc(100% - 1.75rem))` }}
            >
              {formatClock(tooltipRatio * duration)}
            </div>
          ) : null}
        </div>

        <div className="mt-0.5 flex items-center gap-0.5">
          <BarButton label={playLabel} onClick={togglePlay}>
            <PlayIcon className="size-5 fill-current" aria-hidden="true" />
          </BarButton>

          {next ? (
            <BarButton label={`Episode berikutnya: ${next.label}`} onClick={goNext}>
              <SkipForward className="size-5 fill-current" aria-hidden="true" />
            </BarButton>
          ) : null}

          <div className="group/vol flex items-center">
            <BarButton label={effectiveVolume === 0 ? 'Aktifkan suara' : 'Matikan suara'} onClick={toggleMute}>
              <VolumeIcon className="size-5" aria-hidden="true" />
            </BarButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={effectiveVolume}
              aria-label="Volume"
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="player-range hidden w-0 opacity-0 transition-[width,opacity] duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100 group-has-[:focus-visible]/vol:w-20 group-has-[:focus-visible]/vol:opacity-100 sm:block"
              style={{ '--fill': `${effectiveVolume * 100}%` } as CSSProperties}
            />
          </div>

          <span className="ml-1.5 whitespace-nowrap text-[12.5px] tabular-nums text-white sm:ml-2">
            {formatClock(shownTime)}
            <span className="text-zinc-400"> / {formatClock(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-0.5">
            <BarButton
              label={`Lompat ${SKIP_SECONDS} detik`}
              onClick={() => seekBy(SKIP_SECONDS, 'c')}
              className="px-2 text-[12.5px] font-medium tabular-nums"
            >
              <FastForward className="size-[18px] fill-current" aria-hidden="true" />
              <span aria-hidden="true">
                {SKIP_SECONDS}
                <span className="hidden sm:inline"> dtk</span>
              </span>
            </BarButton>

            <BarButton
              ref={menuBtnRef}
              label="Pengaturan pemutar"
              pressed={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Settings className="size-5" aria-hidden="true" />
            </BarButton>

            {pipOk ? (
              <BarButton label="Picture-in-picture" onClick={() => void togglePip()} className="hidden sm:inline-flex">
                <PictureInPicture2 className="size-5" aria-hidden="true" />
              </BarButton>
            ) : null}

            <BarButton
              label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="size-5" aria-hidden="true" />
              ) : (
                <Maximize className="size-5" aria-hidden="true" />
              )}
            </BarButton>
          </div>
        </div>
      </div>
    </div>
  );
}
