'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type HlsType from 'hls.js';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  List,
  Loader2,
  Maximize2,
  MessageCircle,
  Monitor,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EpisodeNavLink, MirrorServer } from '@/lib/scraper/types';
import { CREDITS } from '@/lib/credits';
import { cleanEpisodeTitle, episodeNumberFromTitle } from '@/lib/episode-format';
import { cn } from '@/lib/cn';

interface VideoPlayerProps {
  title: string;
  servers: MirrorServer[];
  defaultEmbed: string | null;
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
/** Batas waktu satu pengukuran server. */
const PROBE_TIMEOUT_MS = 4000;
/** Server yang lebih lambat segini masih boleh menang kalau yang lain belum jawab. */
const GRACE_MS = 250;
/** Jika server terpilih belum selesai dimuat sampai batas ini, pindah otomatis. */
const STALL_MS = 12000;
/** Kunci localStorage untuk preferensi theater. */
const THEATER_KEY = 'aznime:theater';

const isDirect = (s: MirrorServer) => s.type === 'hls' || s.type === 'video';
const normalizeServerName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '');

const isVastads = (s: MirrorServer) => normalizeServerName(s.name).startsWith('vastads');
const isAbyss = (s: MirrorServer) => normalizeServerName(s.name).startsWith('abyss');

const isAllowedServer = (s: MirrorServer) =>
  ALLOWED_SERVERS.some((name) => normalizeServerName(s.name).startsWith(name));

function displayServerName(server: MirrorServer): string {
  if (isVastads(server)) return 'Vastads';
  if (isAbyss(server)) return 'Abyss';
  return server.name.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Mengukur waktu sampai respons (header) pertama dari server, dari jaringan pengguna.
 * Mode no-cors dipakai karena host embed jarang mengirim header CORS; responsnya opaque,
 * tapi waktu tibanya tetap terukur. Koneksi langsung dibatalkan setelah header diterima.
 */
async function probeServer(url: string, signal: AbortSignal): Promise<number> {
  const start = performance.now();
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal,
    });
    return Math.round(performance.now() - start);
  } finally {
    clearTimeout(timer);
    ctrl.abort();
    signal.removeEventListener('abort', onAbort);
  }
}

interface ToolbarButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  ariaLabel?: string;
}

function ToolbarButton({ icon: Icon, label, onClick, active, ariaLabel }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:h-9 sm:min-w-9 sm:px-2.5',
        active
          ? 'bg-white/[0.1] text-white'
          : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

interface EpisodeNavCardProps {
  link: EpisodeNavLink | null;
  direction: 'prev' | 'next';
  seriesTitle?: string | null;
}

function EpisodeNavCard({ link, direction, seriesTitle }: EpisodeNavCardProps) {
  const label = direction === 'prev' ? 'Sebelumnya' : 'Berikutnya';
  const number = link?.number || (link ? episodeNumberFromTitle(link.title) : null);
  const primary = number
    ? `Episode ${number}`
    : link
      ? cleanEpisodeTitle(link.title)
      : 'Tidak tersedia';
  const secondary = link ? seriesTitle || cleanEpisodeTitle(link.title) : null;

  const content = (
    <>
      <span
        className={cn(
          'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600',
          direction === 'next' && 'justify-end'
        )}
      >
        {direction === 'prev' ? <ChevronLeft className="h-3 w-3" aria-hidden="true" /> : null}
        {label}
        {direction === 'next' ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
      </span>
      <span className={cn('mt-0.5 truncate text-[13px] font-semibold', link ? 'text-zinc-200' : 'text-zinc-600')}>
        {primary}
      </span>
      {secondary ? (
        <span
          className={cn(
            'truncate text-[11px] text-zinc-500',
            direction === 'next' && 'text-right'
          )}
        >
          {secondary}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    'flex min-w-0 flex-1 flex-col justify-center rounded-lg px-3 py-2 transition-colors duration-150',
    direction === 'next' ? 'items-end text-right' : 'items-start',
    link ? 'hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60' : 'cursor-default'
  );

  if (!link?.slug) {
    return (
      <span className={className} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link href={`/watch/${encodeURIComponent(link.slug)}`} prefetch={false} className={className}>
      {content}
    </Link>
  );
}

export function VideoPlayer({
  title,
  servers,
  defaultEmbed,
  navigation,
  seriesSlug,
  seriesTitle,
}: VideoPlayerProps) {
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

    // vastads selalu di depan sebagai cadangan pertama.
    return [...list].sort((a, b) => Number(isVastads(b)) - Number(isVastads(a)));
  }, [servers, defaultEmbed]);

  const playable = useMemo(
    () =>
      effectiveServers
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.available && Boolean(s.url)),
    [effectiveServers]
  );

  const fallbackIdx = useMemo(() => {
    const preferred = playable.find(({ s }) => isVastads(s));
    if (preferred) return preferred.i;
    const direct = playable.find(({ s }) => isDirect(s));
    if (direct) return direct.i;
    return playable[0]?.i ?? 0;
  }, [playable]);

  // null = sedang mengukur server mana yang tercepat.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    playable.length > 1 ? null : fallbackIdx
  );
  const [latencies, setLatencies] = useState<Record<number, number | null>>({});
  const [autoIdx, setAutoIdx] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [theater, setTheater] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportCopied, setReportCopied] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');

  const manualRef = useRef(false);
  const triedRef = useRef<Set<number>>(new Set());
  const latencyRef = useRef<Record<number, number | null>>({});
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const reportTimer = useRef<number | undefined>(undefined);

  const activeServer = selectedIdx !== null ? effectiveServers[selectedIdx] || null : null;
  const racing = selectedIdx === null;

  const advanceToNext = useCallback(
    (reason: string): boolean => {
      if (manualRef.current) return false;
      const lat = latencyRef.current;
      const rank = (i: number) => (typeof lat[i] === 'number' ? (lat[i] as number) : 1e9);
      const next = playable
        .map((p) => p.i)
        .filter((i) => !triedRef.current.has(i))
        .sort((a, b) => rank(a) - rank(b))[0];
      if (next === undefined) return false;
      triedRef.current.add(next);
      setNotice(`${reason} Pindah ke ${displayServerName(effectiveServers[next])}.`);
      setSelectedIdx(next);
      return true;
    },
    [playable, effectiveServers]
  );

  // 1) Balapan antar server: yang pertama merespons menjadi default.
  useEffect(() => {
    manualRef.current = false;
    triedRef.current = new Set();
    latencyRef.current = {};
    setLatencies({});
    setAutoIdx(null);
    setNotice(null);
    setMediaError(null);
    setServerErrors(new Set());

    if (playable.length <= 1) {
      setSelectedIdx(fallbackIdx);
      return;
    }
    setSelectedIdx(null);

    const ac = new AbortController();
    let decided = false;
    let settled = 0;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    let hardTimer: ReturnType<typeof setTimeout> | undefined;

    const decide = () => {
      if (decided) return;
      decided = true;
      clearTimeout(graceTimer);
      clearTimeout(hardTimer);
      if (manualRef.current) return;

      let best = -1;
      let bestScore = Infinity;
      for (const { s, i } of playable) {
        const ms = latencyRef.current[i];
        if (typeof ms !== 'number') continue;
        const score = ms - (isDirect(s) ? GRACE_MS : 0);
        if (score < bestScore) {
          best = i;
          bestScore = score;
        }
      }
      const pick = best === -1 ? fallbackIdx : best;
      triedRef.current.add(pick);
      setAutoIdx(best === -1 ? null : pick);
      setSelectedIdx(pick);
    };

    hardTimer = setTimeout(decide, PROBE_TIMEOUT_MS + 200);

    for (const { s, i } of playable) {
      probeServer(s.url as string, ac.signal).then(
        (ms) => {
          if (ac.signal.aborted) return;
          latencyRef.current[i] = ms;
          setLatencies({ ...latencyRef.current });
          settled += 1;
          if (decided) return;
          if (isDirect(s)) decide();
          else if (!graceTimer) graceTimer = setTimeout(decide, GRACE_MS);
        },
        () => {
          if (ac.signal.aborted) return;
          latencyRef.current[i] = null;
          setLatencies({ ...latencyRef.current });
          settled += 1;
          if (!decided && settled >= playable.length) decide();
        }
      );
    }

    return () => {
      decided = true;
      ac.abort();
      clearTimeout(graceTimer);
      clearTimeout(hardTimer);
    };
  }, [playable, fallbackIdx]);

  // 2) Muat server aktif (HLS / video langsung / iframe).
  useEffect(() => {
    setMediaError(null);
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
          hls.loadSource(url);
          hls.attachMedia(videoEl);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) setIsLoading(false);
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

  // 4) Pintasan keyboard untuk mode video langsung.
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

      const video = videoRef.current;
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void frameRef.current?.requestFullscreen();
      } else if (video && activeServer && isDirect(activeServer)) {
        if (e.key === ' ' || e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (video.paused) void video.play();
          else video.pause();
        } else if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          video.muted = !video.muted;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeServer]);

  // 5) Theater: ingat preferensi, kunci scroll, Esc untuk keluar.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(THEATER_KEY) === '1') setTheater(true);
    } catch {
      /* localStorage bisa diblokir; abaikan. */
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = theater ? 'hidden' : '';
    try {
      window.localStorage.setItem(THEATER_KEY, theater ? '1' : '0');
    } catch {
      /* abaikan */
    }
    if (!theater) {
      return () => {
        document.body.style.overflow = '';
      };
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTheater(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [theater]);

  // 6) Dialog laporan: kunci scroll + Esc.
  useEffect(() => {
    if (!reportOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [reportOpen]);

  useEffect(
    () => () => {
      window.clearTimeout(copyTimer.current);
      window.clearTimeout(reportTimer.current);
    },
    []
  );

  const handleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen();
  };

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
    setReportCopied(false);
    setReportOpen(true);
  };

  const copyReport = async () => {
    const ok = await copyText(reportText);
    setReportCopied(ok);
    window.clearTimeout(reportTimer.current);
    reportTimer.current = window.setTimeout(() => setReportCopied(false), 2200);
  };

  const allSeriesHref = navigation.all?.slug
    ? `/anime/${encodeURIComponent(navigation.all.slug)}`
    : seriesSlug
      ? `/anime/${encodeURIComponent(seriesSlug)}`
      : '/anime';

  const serverStatus = (idx: number, server: MirrorServer) => {
    if (!server.available || !server.url) return { label: 'Offline', tone: 'off' as const };
    if (serverErrors.has(idx)) return { label: 'Gagal dimuat', tone: 'error' as const };
    const active = idx === selectedIdx;
    const ms = latencies[idx];
    if (active && isLoading) return { label: 'Memuat...', tone: 'loading' as const };
    if (active) return { label: typeof ms === 'number' ? `Aktif · ${ms} ms` : 'Aktif', tone: 'active' as const };
    if (typeof ms === 'number') return { label: `${ms} ms`, tone: 'idle' as const };
    return { label: isDirect(server) ? 'Direct' : 'Embed', tone: 'idle' as const };
  };

  const toneClass = {
    active: 'bg-emerald-400',
    loading: 'bg-amber-400 animate-pulse',
    error: 'bg-rose-400',
    idle: 'bg-zinc-500',
    off: 'bg-zinc-700',
  };

  return (
    <>
      <div className={theater ? 'fixed inset-0 z-[70] overflow-y-auto bg-[#07080b]' : ''}>
        <div
          className={
            theater
              ? 'mx-auto flex min-h-full w-full max-w-[min(1500px,calc((100vh-220px)*16/9))] flex-col justify-center px-2 py-3 sm:px-4'
              : ''
          }
        >
          <div
            ref={frameRef}
            className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e13] shadow-xl shadow-black/40"
          >
            <div className="relative aspect-video w-full bg-black">
              {racing ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#08090c] text-center"
                >
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/70 motion-reduce:animate-none" />
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">Mencari server tercepat</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {Object.keys(latencies).length} dari {playable.length} server merespons
                    </p>
                  </div>
                </div>
              ) : !activeServer || !activeServer.available || !activeServer.url ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <AlertCircle className="h-7 w-7 text-zinc-500" aria-hidden="true" />
                  <p className="text-[13px] font-semibold text-zinc-200">
                    {activeServer?.message || 'Sumber video belum tersedia'}
                  </p>
                  <p className="max-w-sm text-[11px] text-zinc-500">
                    Coba server lain di bawah, atau pakai tautan unduhan episode ini.
                  </p>
                </div>
              ) : mediaError ? (
                <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <AlertCircle className="h-7 w-7 text-rose-400" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-100">Video gagal dimuat</p>
                    <p className="mt-1 max-w-md text-[11px] text-zinc-500">{mediaError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={retryActive}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3.5 text-[12px] font-semibold text-black transition-colors hover:bg-white/85"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Coba lagi
                  </button>
                </div>
              ) : isDirect(activeServer) ? (
                <video
                  ref={videoRef}
                  controls
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
              ) : (
                <iframe
                  key={`${activeServer.url}-${reloadKey}`}
                  src={activeServer.url}
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
              )}

              {!racing && isLoading && activeServer?.available && activeServer?.url && !mediaError ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50"
                >
                  <div className="flex items-center gap-2 rounded-md bg-[#111319] px-3 py-2 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400 motion-reduce:animate-none" aria-hidden="true" />
                    Memuat {activeServer ? displayServerName(activeServer) : 'server'}
                  </div>
                </div>
              ) : null}

              {copyState !== 'idle' ? (
                <div
                  role="status"
                  className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-black/85 px-3 py-1.5 text-[11px] font-medium text-white ring-1 ring-white/10"
                >
                  {copyState === 'ok' ? 'Tautan episode disalin' : 'Gagal menyalin tautan'}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-2 py-1.5">
              <div className="flex items-center gap-0.5">
                <ToolbarButton
                  icon={Monitor}
                  label={theater ? 'Keluar theater' : 'Theater'}
                  ariaLabel={theater ? 'Keluar dari mode theater' : 'Mode theater'}
                  active={theater}
                  onClick={() => setTheater((value) => !value)}
                />
                <ToolbarButton icon={Maximize2} label="Layar penuh" onClick={handleFullscreen} />
              </div>
              <div className="flex items-center gap-0.5">
                <ToolbarButton icon={Flag} label="Laporkan" onClick={openReport} />
                <ToolbarButton
                  icon={copyState === 'ok' ? Check : Copy}
                  label={copyState === 'ok' ? 'Tersalin' : 'Salin tautan'}
                  onClick={() => void copyEpisodeUrl()}
                />
              </div>
            </div>

            {notice ? (
              <p
                role="status"
                className="border-t border-amber-500/10 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200/90"
              >
                {notice}
              </p>
            ) : null}

            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1 border-t border-white/[0.06] p-1.5">
              <EpisodeNavCard link={navigation.prev} direction="prev" seriesTitle={seriesTitle} />
              <Link
                href={allSeriesHref}
                prefetch={false}
                aria-label="Daftar episode"
                className="inline-flex h-full min-h-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:px-3"
              >
                <List className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Daftar episode</span>
              </Link>
              <EpisodeNavCard link={navigation.next} direction="next" seriesTitle={seriesTitle} />
            </div>

            {effectiveServers.length > 0 ? (
              <div className="border-t border-white/[0.06] p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Server
                  </h2>
                  <span className="text-[10px] text-zinc-600">
                    Otomatis pilih yang tercepat
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Server video">
                  {effectiveServers.map((server, idx) => {
                    const active = idx === selectedIdx;
                    const status = serverStatus(idx, server);
                    const isFastest = autoIdx === idx;
                    return (
                      <button
                        key={`${server.name}-${idx}`}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!server.available}
                        onClick={() => pickManually(idx)}
                        className={cn(
                          'group flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40',
                          active
                            ? 'border-accent/50 bg-accent/[0.08]'
                            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]'
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', toneClass[status.tone])}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-semibold text-zinc-100">
                                {displayServerName(server)}
                              </span>
                              {isFastest ? (
                                <span className="inline-flex items-center gap-0.5 rounded bg-white/[0.08] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-300">
                                  <Zap className="h-2.5 w-2.5" aria-hidden="true" />
                                  Tercepat
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                              {status.label}
                            </span>
                          </span>
                        </span>
                        {active ? (
                          <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        ) : (
                          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-600 transition-colors group-hover:text-zinc-400">
                            Pilih
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {theater ? (
            <p className="py-2 text-center text-[10px] text-zinc-600">
              Tekan Esc atau tombol Theater untuk keluar
            </p>
          ) : null}
        </div>
      </div>

      {reportOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
        >
          <button
            type="button"
            aria-label="Tutup laporan"
            className="absolute inset-0 cursor-default"
            onClick={() => setReportOpen(false)}
            tabIndex={-1}
          />
          <div className="relative w-full max-w-md rounded-t-xl border border-white/[0.1] bg-[#101218] p-4 shadow-2xl sm:rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="report-title" className="text-sm font-semibold text-white">
                  Laporkan masalah pemutar
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  Salin detail di bawah, lalu kirim ke channel WhatsApp pengelola supaya bisa dicek.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                aria-label="Tutup"
                className="-mr-1 -mt-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-300">
              {reportText}
            </pre>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyReport()}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-[12px] font-semibold text-black transition-colors hover:bg-white/85"
              >
                {reportCopied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                {reportCopied ? 'Detail tersalin' : 'Salin detail'}
              </button>
              <a
                href={CREDITS[0]?.channelUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.1] px-3 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Buka WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="ml-auto inline-flex h-9 cursor-pointer items-center rounded-md px-3 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
