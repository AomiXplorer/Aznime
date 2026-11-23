'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type HlsType from 'hls.js';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Flag,
  List,
  Loader2,
  Maximize2,
  Monitor,
  RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EpisodeNavLink, MirrorServer } from '@/lib/scraper/types';
import { cleanEpisodeTitle, episodeNumberFromTitle } from '@/lib/episode-format';
import { cn } from '@/lib/cn';
import { DirectControls } from './player/DirectControls';
import type { EpisodeTarget, QualityControl } from './player/DirectControls';
import { ReportDialog } from './player/ReportDialog';
import { copyText } from './player/copy';
import { safeStorage } from './player/format';

interface VideoPlayerProps {
  title: string;
  servers: MirrorServer[];
  defaultEmbed: string | null;
  episodes: EpisodeNavLink[];
  navigation: {
    prev: EpisodeNavLink | null;
    all: EpisodeNavLink | null;
    next: EpisodeNavLink | null;
  };
  seriesSlug: string | null;
  seriesTitle?: string | null;
}

/** Hanya dua server ini yang dipakai; sisanya disembunyikan. */
const ALLOWED_SERVERS = ['vastads', 'abyss'] as const;
/** Server default saat halaman dibuka. */
const DEFAULT_SERVER = 'abyss';
/** Jika server terpilih belum selesai dimuat sampai batas ini, pindah ke cadangan. */
const STALL_MS = 12000;
/** Kunci localStorage untuk preferensi theater. */
const THEATER_KEY = 'aznime:theater';

const isDirect = (s: MirrorServer) => s.type === 'hls' || s.type === 'video';
const normalizeServerName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '');

const isVastads = (s: MirrorServer) => normalizeServerName(s.name).startsWith('vastads');
const isAbyss = (s: MirrorServer) => normalizeServerName(s.name).startsWith('abyss');

const isDefaultServer = (s: MirrorServer) => normalizeServerName(s.name).startsWith(DEFAULT_SERVER);
const isAllowedServer = (s: MirrorServer) =>
  ALLOWED_SERVERS.some((name) => normalizeServerName(s.name).startsWith(name));

function displayServerName(server: MirrorServer): string {
  if (isVastads(server)) return 'Vastads';
  if (isAbyss(server)) return 'Abyss';
  return server.name.replace(/\b\w/g, (char) => char.toUpperCase());
}

function toTarget(link: EpisodeNavLink | null): EpisodeTarget | null {
  if (!link?.slug) return null;
  const number = link.number || episodeNumberFromTitle(link.title);
  return {
    href: `/watch/${encodeURIComponent(link.slug)}`,
    label: number ? `Episode ${number}` : cleanEpisodeTitle(link.title),
  };
}

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}

/** Tombol ikon tanpa teks: aria-label wajib supaya tetap terbaca pembaca layar. */
function IconButton({ icon: Icon, label, onClick, active }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'inline-flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        active ? 'bg-white/[0.12] text-white' : 'text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  );
}

interface EpisodeNavButtonProps {
  link: EpisodeNavLink | null;
  direction: 'prev' | 'next';
  seriesTitle?: string | null;
}

function EpisodeNavButton({ link, direction, seriesTitle }: EpisodeNavButtonProps) {
  const number = link?.number || (link ? episodeNumberFromTitle(link.title) : null);
  const text = number ? `Ep ${number}` : link ? cleanEpisodeTitle(link.title) : 'Tidak ada';
  const hint = link
    ? [
        direction === 'prev' ? 'Episode sebelumnya' : 'Episode berikutnya',
        seriesTitle,
        number ? `Episode ${number}` : cleanEpisodeTitle(link.title),
      ]
        .filter(Boolean)
        .join(' · ')
    : direction === 'prev'
      ? 'Tidak ada episode sebelumnya'
      : 'Tidak ada episode berikutnya';

  const className = cn(
    'inline-flex h-9 min-w-0 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium transition-colors duration-150',
    direction === 'next' && 'justify-end',
    link
      ? 'text-zinc-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
      : 'cursor-default text-zinc-600'
  );

  const content = (
    <>
      {direction === 'prev' ? <ChevronLeft className="size-4 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{text}</span>
      {direction === 'next' ? <ChevronRight className="size-4 shrink-0" aria-hidden="true" /> : null}
    </>
  );

  if (!link?.slug) {
    return (
      <span className={className} aria-disabled="true" title={hint}>
        {content}
      </span>
    );
  }

  return (
    <Link href={`/watch/${encodeURIComponent(link.slug)}`} prefetch={false} className={className} title={hint}>
      {content}
    </Link>
  );
}

export function VideoPlayer({
  title,
  servers,
  defaultEmbed,
  episodes,
  navigation,
  seriesSlug,
  seriesTitle,
}: VideoPlayerProps) {
  const pathname = usePathname();

  const effectiveServers = useMemo<MirrorServer[]>(() => {
    const base =
      servers.length > 0
        ? servers
        : defaultEmbed
          ? [
              {
                name: 'Server Utama',
                available: true,
                type: /\.m3u8(\?|$)/i.test(defaultEmbed) ? ('hls' as const) : ('iframe' as const),
                url: defaultEmbed,
              },
            ]
          : [];

    if (base.length === 0) return base;

    // Batasi ke vastads + abyss. Kalau upstream mengganti nama server,
    // tampilkan semua supaya episode tetap bisa ditonton.
    const allowed = base.filter(isAllowedServer);
    const list = allowed.length > 0 ? allowed : base;

    // Abyss dipakai sebagai server default, jadi selalu tampil paling depan.
    return [...list].sort((a, b) => Number(isAbyss(b)) - Number(isAbyss(a)));
  }, [servers, defaultEmbed]);

  const playable = useMemo(
    () =>
      effectiveServers
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.available && Boolean(s.url)),
    [effectiveServers]
  );

  const fallbackIdx = useMemo(() => {
    const preferred = playable.find(({ s }) => isDefaultServer(s));
    if (preferred) return preferred.i;
    const direct = playable.find(({ s }) => isDirect(s));
    if (direct) return direct.i;
    return playable[0]?.i ?? 0;
  }, [playable]);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(fallbackIdx);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [theater, setTheater] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [qualityOptions, setQualityOptions] = useState<QualityControl['options']>([]);
  const [qualityLevel, setQualityLevel] = useState(-1);

  const manualRef = useRef(false);
  const triedRef = useRef<Set<number>>(new Set());
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const activeServer = selectedIdx !== null ? effectiveServers[selectedIdx] || null : null;

  const prevTarget = useMemo(() => toTarget(navigation.prev), [navigation.prev]);
  const nextTarget = useMemo(() => toTarget(navigation.next), [navigation.next]);

  const selectQuality = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index;
    setQualityLevel(index);
  }, []);

  const quality = useMemo<QualityControl | null>(
    () =>
      qualityOptions.length > 1
        ? { options: qualityOptions, current: qualityLevel, onSelect: selectQuality }
        : null,
    [qualityOptions, qualityLevel, selectQuality]
  );

  const advanceToNext = useCallback(
    (reason: string): boolean => {
      if (manualRef.current) return false;
      const next = playable.map((p) => p.i).find((i) => !triedRef.current.has(i));
      if (next === undefined) return false;
      triedRef.current.add(next);
      setNotice(`${reason} Pindah ke ${displayServerName(effectiveServers[next])}.`);
      setSelectedIdx(next);
      return true;
    },
    [playable, effectiveServers]
  );

  // 1) Server default: Abyss kalau tersedia, kalau tidak server pertama yang bisa diputar.
  //    Tidak ada lagi pengukuran/balapan kecepatan antar server.
  useEffect(() => {
    manualRef.current = false;
    triedRef.current = new Set([fallbackIdx]);
    setSelectedIdx(fallbackIdx);
    setNotice(null);
    setMediaError(null);
    setServerErrors(new Set());
  }, [fallbackIdx]);

  // 2) Muat server aktif (HLS / video langsung / iframe).
  useEffect(() => {
    setMediaError(null);
    setQualityOptions([]);
    setQualityLevel(-1);
    hlsRef.current = null;
    if (!activeServer || !activeServer.available || !activeServer.url) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (!isDirect(activeServer)) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    const activeIdx = selectedIdx;
    let cancelled = false;
    let hls: HlsType | null = null;
    const url = activeServer.url;

    const fail = (message: string) => {
      if (cancelled) return;
      setIsLoading(false);
      if (activeIdx !== null) {
        setServerErrors((prev) => new Set(prev).add(activeIdx));
      }
      if (!advanceToNext(`${displayServerName(activeServer)} gagal diputar.`)) {
        setMediaError(message);
      }
    };

    const wantsHls = activeServer.type === 'hls' || /\.m3u8(\?|$)/i.test(url);

    if (!wantsHls || videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
    } else {
      void (async () => {
        try {
          const mod = await import('hls.js');
          if (cancelled) return;
          const Hls = mod.default;
          if (!Hls.isSupported()) {
            fail('Browser Anda belum mendukung pemutaran HLS. Coba server lain.');
            return;
          }
          hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(videoEl);
          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            if (cancelled) return;
            setIsLoading(false);
            // Satu pilihan per resolusi; kalau ada beberapa bitrate, ambil yang tertinggi.
            const byHeight = new Map<number, number>();
            data.levels.forEach((level, index) => {
              if (level.height > 0) byHeight.set(level.height, index);
            });
            setQualityOptions(
              [...byHeight.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([height, index]) => ({ index, label: `${height}p` }))
            );
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) fail('Stream HLS gagal dimuat. Coba server lain di bawah.');
          });
        } catch {
          fail('Pemutar HLS gagal dimuat. Coba server lain di bawah.');
        }
      })();
    }

    return () => {
      cancelled = true;
      hls?.destroy();
      hlsRef.current = null;
      videoEl.removeAttribute('src');
      videoEl.load();
    };
  }, [activeServer, advanceToNext, reloadKey, selectedIdx]);

  // 3) Jika server terpilih macet, pindah otomatis.
  useEffect(() => {
    if (!activeServer || !isLoading || manualRef.current) return;
    const t = setTimeout(() => {
      if (selectedIdx !== null) {
        setServerErrors((prev) => new Set(prev).add(selectedIdx));
      }
      advanceToNext(`${displayServerName(activeServer)} terlalu lama dimuat.`);
    }, STALL_MS);
    return () => clearTimeout(t);
  }, [activeServer, isLoading, advanceToNext, selectedIdx]);

  // 4) Layar penuh: berlaku untuk semua jenis server (iframe maupun video langsung).
  const toggleFullscreen = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (stage.requestFullscreen) {
        await stage.requestFullscreen();
      } else {
        // iOS Safari hanya bisa layar penuh lewat elemen <video> itu sendiri.
        const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        video?.webkitEnterFullscreen?.();
      }
    } catch {
      /* browser menolak layar penuh; abaikan */
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement !== null && document.fullscreenElement === stageRef.current;
      setIsFullscreen(active);
      try {
        const orientation = screen.orientation as unknown as {
          lock?: (mode: string) => Promise<void>;
          unlock?: () => void;
        };
        if (active && window.matchMedia('(pointer: coarse)').matches) {
          void orientation.lock?.('landscape').catch(() => undefined);
        } else if (!active) {
          orientation.unlock?.();
        }
      } catch {
        /* kunci orientasi tidak didukung */
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen]);

  // 5) Theater: ingat preferensi, kunci scroll, Esc untuk keluar.
  useEffect(() => {
    if (safeStorage.get(THEATER_KEY) === '1') setTheater(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = theater ? 'hidden' : '';
    safeStorage.set(THEATER_KEY, theater ? '1' : '0');
    if (!theater) {
      return () => {
        document.body.style.overflow = '';
      };
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) setTheater(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [theater]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const pickManually = (idx: number) => {
    manualRef.current = true;
    triedRef.current.add(idx);
    setNotice(null);
    setMediaError(null);
    setServerErrors((prev) => {
      if (!prev.has(idx)) return prev;
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
    if (idx === selectedIdx) setReloadKey((key) => key + 1);
    setIsLoading(true);
    setSelectedIdx(idx);
  };

  const retryActive = () => {
    setMediaError(null);
    setNotice(null);
    if (selectedIdx !== null) {
      setServerErrors((prev) => {
        if (!prev.has(selectedIdx)) return prev;
        const next = new Set(prev);
        next.delete(selectedIdx);
        return next;
      });
    }
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  };

  const copyEpisodeUrl = async () => {
    const ok = await copyText(window.location.href);
    setCopyState(ok ? 'ok' : 'fail');
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 2200);
  };

  const openReport = () => {
    const lines = [
      'Laporan pemutar Aznime',
      `Judul: ${title}`,
      `URL: ${window.location.href}`,
      `Server: ${activeServer ? displayServerName(activeServer) : '-'}`,
      `Tipe: ${activeServer?.type || '-'}`,
      `Waktu: ${new Date().toISOString()}`,
    ];
    setReportText(lines.join('\n'));
  };

  const closeReport = useCallback(() => setReportText(null), []);

  const allSeriesHref = navigation.all?.slug
    ? `/anime/${encodeURIComponent(navigation.all.slug)}`
    : seriesSlug
      ? `/anime/${encodeURIComponent(seriesSlug)}`
      : '/anime';

  /** Status ditampilkan hanya kalau ada yang perlu diketahui; server sehat cukup ditandai garis bawah. */
  const serverStatus = (idx: number, server: MirrorServer) => {
    if (!server.available || !server.url) return { label: 'Tidak tersedia', dot: 'bg-zinc-600' };
    if (serverErrors.has(idx)) return { label: 'Gagal', dot: 'bg-rose-400' };
    if (idx === selectedIdx && isLoading) return { label: 'Memuat', dot: 'bg-amber-400 animate-pulse' };
    return { label: '', dot: '' };
  };

  const showLoading = isLoading && Boolean(activeServer?.available && activeServer?.url) && !mediaError;
  const hasSource = Boolean(activeServer?.available && activeServer?.url);

  return (
    <>
      <div className={theater ? 'fixed inset-0 z-[70] overflow-y-auto bg-[#07080b]' : ''}>
        <div
          className={
            theater
              ? 'mx-auto flex min-h-full w-full max-w-[min(1500px,calc((100vh-200px)*16/9))] flex-col justify-center px-2 py-3 sm:px-4'
              : ''
          }
        >
          <div className="bg-surface sm:rounded-lg">
            <div ref={stageRef} className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-t-lg [&:fullscreen]:aspect-auto">
              {!hasSource ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <AlertCircle className="size-6 text-zinc-500" aria-hidden="true" />
                  <p className="text-[13px] font-semibold text-zinc-200">
                    {activeServer?.message || 'Sumber video belum tersedia'}
                  </p>
                  <p className="max-w-sm text-[12px] leading-relaxed text-zinc-500">
                    Pilih server lain di bawah, atau pakai tautan unduhan episode ini.
                  </p>
                </div>
              ) : mediaError ? (
                <div
                  role="alert"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
                >
                  <AlertCircle className="size-6 text-rose-400" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-100">Video gagal dimuat</p>
                    <p className="mt-1 max-w-md text-[12px] leading-relaxed text-zinc-400">{mediaError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={retryActive}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3.5 text-[12.5px] font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Muat ulang
                  </button>
                </div>
              ) : activeServer && isDirect(activeServer) ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={() => setIsLoading(false)}
                    onLoadedData={() => setIsLoading(false)}
                    onCanPlay={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      if (selectedIdx !== null) {
                        setServerErrors((prev) => new Set(prev).add(selectedIdx));
                      }
                      if (!advanceToNext(`${displayServerName(activeServer)} gagal diputar.`)) {
                        setMediaError('Video gagal diputar dari server ini. Coba server lain.');
                      }
                    }}
                    className="h-full w-full bg-black"
                  />
                  <DirectControls
                    key={`${selectedIdx}-${reloadKey}`}
                    videoRef={videoRef}
                    title={title}
                    seriesTitle={seriesTitle}
                    loading={isLoading}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => void toggleFullscreen()}
                    next={nextTarget}
                    prev={prevTarget}
                    quality={quality}
                    storageKey={pathname || title}
                  />
                </>
              ) : activeServer ? (
                <iframe
                  key={`${activeServer.url}-${reloadKey}`}
                  src={activeServer.url ?? undefined}
                  title={`Pemutar ${title} - ${displayServerName(activeServer)}`}
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  /* Abyss suka membuka tab iklan saat tombol play ditekan. Sandbox tanpa
                     allow-popups / allow-top-navigation memblokir popup dan redirect halaman,
                     tanpa mengganggu pemutaran video di dalam iframe. */
                  sandbox={
                    isAbyss(activeServer)
                      ? 'allow-scripts allow-same-origin allow-forms allow-presentation'
                      : undefined
                  }
                  onLoad={() => setIsLoading(false)}
                  className="h-full w-full border-0"
                />
              ) : null}

              {showLoading ? (
                <>
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
                    aria-hidden="true"
                  >
                    <div className="player-sweep h-full w-2/5 bg-accent" />
                  </div>
                  <div
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45"
                  >
                    <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-zinc-200">
                      <Loader2
                        className="size-4 animate-spin text-zinc-300 motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      Memuat {activeServer ? displayServerName(activeServer) : 'server'}
                    </span>
                  </div>
                </>
              ) : null}

              {copyState !== 'idle' ? (
                <div
                  role="status"
                  className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/80 px-3 py-1.5 text-[12px] font-medium text-white"
                >
                  {copyState === 'ok' ? 'Tautan episode disalin' : 'Tautan gagal disalin'}
                </div>
              ) : null}
            </div>

            {/* Server di kiri (bisa digeser), aksi di kanan. */}
            <div className="flex items-center gap-1 pl-1 pr-1 sm:pl-2">
              <div className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
                <span className="shrink-0 pl-1.5 pr-1 text-[12px] text-zinc-500">Server</span>
                <div role="group" aria-label="Pilih server video" className="flex items-center">
                  {effectiveServers.map((server, idx) => {
                    const active = idx === selectedIdx;
                    const status = serverStatus(idx, server);
                    return (
                      <button
                        key={`${server.name}-${idx}`}
                        type="button"
                        aria-pressed={active}
                        disabled={!server.available}
                        onClick={() => pickManually(idx)}
                        title={status.label ? `${displayServerName(server)}: ${status.label}` : displayServerName(server)}
                        className={cn(
                          "relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors duration-150 after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-accent after:transition-opacity after:duration-150 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40",
                          active
                            ? 'text-white after:opacity-100'
                            : 'text-zinc-400 after:opacity-0 hover:text-zinc-100'
                        )}
                      >
                        {status.dot ? (
                          <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} aria-hidden="true" />
                        ) : null}
                        <span className="whitespace-nowrap">{displayServerName(server)}</span>
                        {status.label ? (
                          <span className="whitespace-nowrap text-[11.5px] font-normal text-zinc-500">
                            {status.label}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 border-l border-line pl-1">
                <IconButton
                  icon={Monitor}
                  label={theater ? 'Keluar mode theater' : 'Mode theater'}
                  active={theater}
                  onClick={() => setTheater((value) => !value)}
                />
                <IconButton icon={Maximize2} label="Layar penuh" onClick={() => void toggleFullscreen()} />
                <IconButton
                  icon={copyState === 'ok' ? Check : Copy}
                  label={copyState === 'ok' ? 'Tautan tersalin' : 'Salin tautan episode'}
                  onClick={() => void copyEpisodeUrl()}
                />
                <IconButton icon={Flag} label="Laporkan masalah pemutar" onClick={openReport} />
              </div>
            </div>

            {/* Navigasi episode: satu baris, tinggi tetap, state kosong tetap terlihat. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-t border-line px-1 py-0.5 sm:px-2">
              <EpisodeNavButton link={navigation.prev} direction="prev" seriesTitle={seriesTitle} />
              <details className="group relative">
                <summary
                  aria-label="Pilih episode"
                  title="Pilih episode"
                  className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 [&::-webkit-details-marker]:hidden"
                >
                  <List className="size-4" aria-hidden="true" />
                  <span>Pilih episode</span>
                </summary>
                <div className="absolute left-1/2 top-full z-40 mt-2 max-h-[min(60vh,26rem)] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-md border border-line bg-elevated p-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    Episode {seriesTitle ? `· ${seriesTitle}` : ''}
                  </p>
                  {episodes.length > 0 ? (
                    <ul aria-label="Pilih episode" className="grid grid-cols-2 gap-1">
                      {episodes.map((episode, index) => {
                        const number = episode.number || episodeNumberFromTitle(episode.title);
                        const isCurrent = Boolean(
                          episode.slug &&
                            (pathname.endsWith(`/${encodeURIComponent(episode.slug)}`) ||
                              pathname.endsWith(`/${episode.slug}`))
                        );
                        return (
                          <li key={episode.slug || `${episode.title}-${index}`}>
                            {episode.slug ? (
                              <Link
                                href={`/watch/${encodeURIComponent(episode.slug)}`}
                                prefetch={false}
                                aria-current={isCurrent ? 'page' : undefined}
                                title={episode.title}
                                className={cn(
                                  'flex min-h-9 items-center gap-2 rounded-sm px-2 text-[11.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                                  isCurrent
                                    ? 'bg-white/[0.1] text-white'
                                    : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                                )}
                              >
                                <span className="shrink-0 font-mono tabular-nums text-zinc-500">
                                  {number ? `Ep ${number}` : 'Ep'}
                                </span>
                                {isCurrent ? (
                                  <span className="sr-only">Episode sedang diputar: </span>
                                ) : null}
                                <span className="min-w-0 truncate">{episode.title}</span>
                              </Link>
                            ) : (
                              <span className="flex min-h-9 items-center gap-2 px-2 text-[11.5px] text-zinc-500">
                                <span className="shrink-0 font-mono tabular-nums">
                                  {number ? `Ep ${number}` : 'Ep'}
                                </span>
                                <span className="min-w-0 truncate">{episode.title}</span>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="px-2 py-3 text-[12px] text-zinc-500">
                      Daftar episode belum tersedia.
                    </p>
                  )}
                  {allSeriesHref ? (
                    <Link
                      href={allSeriesHref}
                      prefetch={false}
                      className="mt-2 flex min-h-9 items-center rounded-sm border-t border-line px-2 pt-2 text-[11.5px] font-medium text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      Buka halaman seri
                    </Link>
                  ) : null}
                </div>
              </details>
              <EpisodeNavButton link={navigation.next} direction="next" seriesTitle={seriesTitle} />
            </div>

            {notice ? (
              <p
                role="status"
                className="border-t border-line bg-white/[0.03] px-3 py-2 text-[12px] text-zinc-400"
              >
                {notice}
              </p>
            ) : null}
          </div>

          {theater ? (
            <p className="py-2 text-center text-[11px] text-zinc-500">
              Tekan Esc atau tombol theater untuk keluar
            </p>
          ) : null}
        </div>
      </div>

      {reportText !== null ? <ReportDialog text={reportText} onClose={closeReport} /> : null}
    </>
  );
}
