'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
<<<<<<< HEAD
import type HlsType from 'hls.js';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
=======
import { usePathname } from 'next/navigation';
import type HlsType from 'hls.js';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
>>>>>>> c5dfbd0 (Update maintennace)
  Copy,
  Flag,
  List,
  Loader2,
  Maximize2,
<<<<<<< HEAD
  MessageCircle,
  Monitor,
  RotateCcw,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EpisodeNavLink, MirrorServer } from '@/lib/scraper/types';
import { CREDITS } from '@/lib/credits';
import { cleanEpisodeTitle, episodeNumberFromTitle } from '@/lib/episode-format';
import { cn } from '@/lib/cn';
=======
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
>>>>>>> c5dfbd0 (Update maintennace)

interface VideoPlayerProps {
  title: string;
  servers: MirrorServer[];
  defaultEmbed: string | null;
<<<<<<< HEAD
=======
  episodes: EpisodeNavLink[];
>>>>>>> c5dfbd0 (Update maintennace)
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

<<<<<<< HEAD
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
=======
function toTarget(link: EpisodeNavLink | null): EpisodeTarget | null {
  if (!link?.slug) return null;
  const number = link.number || episodeNumberFromTitle(link.title);
  return {
    href: `/watch/${encodeURIComponent(link.slug)}`,
    label: number ? `Episode ${number}` : cleanEpisodeTitle(link.title),
  };
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
        'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        active ? 'bg-white/[0.12] text-white' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
=======
        'inline-flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
        active ? 'bg-white/[0.12] text-white' : 'text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
  const text = number ? `Ep ${number}` : link ? cleanEpisodeTitle(link.title) : 'Tidak ada';
  const hint = link
    ? [direction === 'prev' ? 'Episode sebelumnya' : 'Episode berikutnya', seriesTitle, number ? `Episode ${number}` : cleanEpisodeTitle(link.title)]
=======
  const label = direction === 'prev' ? 'Sebelumnya' : 'Berikutnya';
  const value = number ? `Episode ${number}` : link ? cleanEpisodeTitle(link.title) : 'Tidak tersedia';
  const hint = link
    ? [
        direction === 'prev' ? 'Episode sebelumnya' : 'Episode berikutnya',
        seriesTitle,
        number ? `Episode ${number}` : cleanEpisodeTitle(link.title),
      ]
>>>>>>> c5dfbd0 (Update maintennace)
        .filter(Boolean)
        .join(' · ')
    : direction === 'prev'
      ? 'Tidak ada episode sebelumnya'
      : 'Tidak ada episode berikutnya';

<<<<<<< HEAD
  const className = cn(
    'inline-flex h-8 min-w-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors duration-150',
    direction === 'next' && 'justify-end',
    link
      ? 'text-zinc-300 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
      : 'cursor-default text-zinc-600'
=======
  /* Dua baris: label arah yang kecil di atas, nomor episode sebagai titik baca
     utama. Slot tanpa episode tetap dirender supaya lebar kiri dan kanan sama
     dan tombol tengah tidak bergeser. */
  const alignEnd = direction === 'next';

  const className = cn(
    'group flex h-12 min-w-0 max-w-full items-center gap-1.5 rounded-md px-2 transition-colors duration-150 sm:h-11',
    alignEnd ? 'justify-end justify-self-end' : 'justify-start justify-self-start',
    link
      ? 'text-zinc-100 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
      : 'cursor-default'
  );

  const chevronClass = cn(
    'size-4 shrink-0 transition-colors duration-150',
    link ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-700'
>>>>>>> c5dfbd0 (Update maintennace)
  );

  const content = (
    <>
<<<<<<< HEAD
      {direction === 'prev' ? <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{text}</span>
      {direction === 'next' ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
=======
      {direction === 'prev' ? (
        <ChevronLeft className={chevronClass} strokeWidth={1.75} aria-hidden="true" />
      ) : null}
      <span className={cn('flex min-w-0 flex-1 flex-col', alignEnd ? 'items-end' : 'items-start')}>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase leading-none tracking-[0.12em]',
            link ? 'text-zinc-500' : 'text-zinc-700'
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'mt-1 w-full min-w-0 truncate text-[13px] leading-tight',
            alignEnd && 'text-right',
            link ? 'font-medium' : 'text-zinc-600'
          )}
        >
          {value}
        </span>
      </span>
      {direction === 'next' ? (
        <ChevronRight className={chevronClass} strokeWidth={1.75} aria-hidden="true" />
      ) : null}
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
=======
  episodes,
>>>>>>> c5dfbd0 (Update maintennace)
  navigation,
  seriesSlug,
  seriesTitle,
}: VideoPlayerProps) {
<<<<<<< HEAD
=======
  const pathname = usePathname();

>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportCopied, setReportCopied] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');

  const manualRef = useRef(false);
  const triedRef = useRef<Set<number>>(new Set());
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);
  const reportTimer = useRef<number | undefined>(undefined);

  const activeServer = selectedIdx !== null ? effectiveServers[selectedIdx] || null : null;

=======
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

>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
=======
    setQualityOptions([]);
    setQualityLevel(-1);
    hlsRef.current = null;
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
          hls.loadSource(url);
          hls.attachMedia(videoEl);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) setIsLoading(false);
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
=======
      hlsRef.current = null;
>>>>>>> c5dfbd0 (Update maintennace)
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

<<<<<<< HEAD
  // 4) Pintasan keyboard untuk mode video langsung.
=======
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

>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD

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
=======
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleFullscreen();
>>>>>>> c5dfbd0 (Update maintennace)
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
<<<<<<< HEAD
  }, [activeServer]);

  // 5) Theater: ingat preferensi, kunci scroll, Esc untuk keluar.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(THEATER_KEY) === '1') setTheater(true);
    } catch {
      /* localStorage bisa diblokir; abaikan. */
    }
=======
  }, [toggleFullscreen]);

  // 5) Theater: ingat preferensi, kunci scroll, Esc untuk keluar.
  useEffect(() => {
    if (safeStorage.get(THEATER_KEY) === '1') setTheater(true);
>>>>>>> c5dfbd0 (Update maintennace)
  }, []);

  useEffect(() => {
    document.body.style.overflow = theater ? 'hidden' : '';
<<<<<<< HEAD
    try {
      window.localStorage.setItem(THEATER_KEY, theater ? '1' : '0');
    } catch {
      /* abaikan */
    }
=======
    safeStorage.set(THEATER_KEY, theater ? '1' : '0');
>>>>>>> c5dfbd0 (Update maintennace)
    if (!theater) {
      return () => {
        document.body.style.overflow = '';
      };
    }
    const onKey = (e: KeyboardEvent) => {
<<<<<<< HEAD
      if (e.key === 'Escape') setTheater(false);
=======
      if (e.key === 'Escape' && !document.fullscreenElement) setTheater(false);
>>>>>>> c5dfbd0 (Update maintennace)
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [theater]);

<<<<<<< HEAD
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
=======
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);
>>>>>>> c5dfbd0 (Update maintennace)

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
<<<<<<< HEAD
    setReportCopied(false);
    setReportOpen(true);
  };

  const copyReport = async () => {
    const ok = await copyText(reportText);
    setReportCopied(ok);
    window.clearTimeout(reportTimer.current);
    reportTimer.current = window.setTimeout(() => setReportCopied(false), 2200);
  };
=======
  };

  const closeReport = useCallback(() => setReportText(null), []);

  /* Posisi episode yang sedang diputar, dibaca dari daftar episode yang sudah
     dimuat. Dipakai tombol tengah navigasi ("3 / 12") tanpa mengubah rute. */
  const episodePosition = useMemo(() => {
    const segment = decodeURIComponent(pathname?.split('/').filter(Boolean).pop() || '');
    const index = episodes.findIndex((episode) => episode.slug && episode.slug === segment);
    if (index < 0) return null;
    const number = episodes[index].number || episodeNumberFromTitle(episodes[index].title);
    return { number, total: episodes.length };
  }, [episodes, pathname]);
>>>>>>> c5dfbd0 (Update maintennace)

  const allSeriesHref = navigation.all?.slug
    ? `/anime/${encodeURIComponent(navigation.all.slug)}`
    : seriesSlug
      ? `/anime/${encodeURIComponent(seriesSlug)}`
      : '/anime';

<<<<<<< HEAD
  const serverStatus = (idx: number, server: MirrorServer) => {
    if (!server.available || !server.url) return { label: 'Tidak tersedia', tone: 'off' as const };
    if (serverErrors.has(idx)) return { label: 'Gagal dimuat', tone: 'error' as const };
    if (idx === selectedIdx) {
      return isLoading
        ? { label: 'Memuat', tone: 'loading' as const }
        : { label: 'Aktif', tone: 'active' as const };
    }
    return { label: '', tone: 'idle' as const };
  };

  const toneClass = {
    active: 'bg-emerald-400',
    loading: 'bg-amber-400 animate-pulse',
    error: 'bg-rose-400',
    idle: 'bg-zinc-500',
    off: 'bg-zinc-700',
  };
=======
  /** Status ditampilkan hanya kalau ada yang perlu diketahui; server sehat cukup ditandai garis bawah. */
  const serverStatus = (idx: number, server: MirrorServer) => {
    if (!server.available || !server.url) return { label: 'Tidak tersedia', dot: 'bg-zinc-600' };
    if (serverErrors.has(idx)) return { label: 'Gagal', dot: 'bg-rose-400' };
    if (idx === selectedIdx && isLoading) return { label: 'Memuat', dot: 'bg-amber-400 animate-pulse' };
    return { label: '', dot: '' };
  };

  const showLoading = isLoading && Boolean(activeServer?.available && activeServer?.url) && !mediaError;
  const hasSource = Boolean(activeServer?.available && activeServer?.url);
>>>>>>> c5dfbd0 (Update maintennace)

  return (
    <>
      <div className={theater ? 'fixed inset-0 z-[70] overflow-y-auto bg-[#07080b]' : ''}>
        <div
          className={
            theater
<<<<<<< HEAD
              ? 'mx-auto flex min-h-full w-full max-w-[min(1500px,calc((100vh-190px)*16/9))] flex-col justify-center px-2 py-3 sm:px-4'
              : ''
          }
        >
          <div ref={frameRef} className="overflow-hidden bg-black sm:rounded-lg">
            <div className="relative aspect-video w-full bg-black">
              {!activeServer || !activeServer.available || !activeServer.url ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <AlertCircle className="h-6 w-6 text-zinc-500" aria-hidden="true" />
                  <p className="text-[12.5px] font-semibold text-zinc-200">
                    {activeServer?.message || 'Sumber video belum tersedia'}
                  </p>
                  <p className="max-w-sm text-[11px] leading-relaxed text-zinc-500">
                    Coba server lain di bawah, atau pakai tautan unduhan episode ini.
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
                  </p>
                </div>
              ) : mediaError ? (
                <div
                  role="alert"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
                >
<<<<<<< HEAD
                  <AlertCircle className="h-6 w-6 text-rose-400" aria-hidden="true" />
                  <div>
                    <p className="text-[12.5px] font-semibold text-zinc-100">Video gagal dimuat</p>
                    <p className="mt-1 max-w-md text-[11px] leading-relaxed text-zinc-500">{mediaError}</p>
=======
                  <AlertCircle className="size-6 text-rose-400" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-100">Video gagal dimuat</p>
                    <p className="mt-1 max-w-md text-[12px] leading-relaxed text-zinc-400">{mediaError}</p>
>>>>>>> c5dfbd0 (Update maintennace)
                  </div>
                  <button
                    type="button"
                    onClick={retryActive}
<<<<<<< HEAD
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-[12px] font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
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
<<<<<<< HEAD
              )}

              {isLoading && activeServer?.available && activeServer?.url && !mediaError ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45"
                >
                  <span className="inline-flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300">
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-zinc-400 motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Memuat {activeServer ? displayServerName(activeServer) : 'server'}
                  </span>
                </div>
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
              ) : null}

              {copyState !== 'idle' ? (
                <div
                  role="status"
<<<<<<< HEAD
                  className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-md bg-black/85 px-2.5 py-1.5 text-[11px] font-medium text-white"
                >
                  {copyState === 'ok' ? 'Tautan episode disalin' : 'Gagal menyalin tautan'}
=======
                  className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/80 px-3 py-1.5 text-[12px] font-medium text-white"
                >
                  {copyState === 'ok' ? 'Tautan episode disalin' : 'Tautan gagal disalin'}
>>>>>>> c5dfbd0 (Update maintennace)
                </div>
              ) : null}
            </div>

<<<<<<< HEAD
            {/* Satu strip kendali: server di kiri (bisa digeser), aksi di kanan. */}
            <div className="flex items-stretch gap-1 bg-[#0a0c11] py-1.5 pl-1 pr-1 sm:pl-1.5">
              <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-0.5">
                <div
                  role="radiogroup"
                  aria-label="Server video"
                  className="flex items-center gap-1"
                >
                  {effectiveServers.map((server, idx) => {
                    const active = idx === selectedIdx;
                    const status = serverStatus(idx, server);
                    const state = status.label ? status.label.toLowerCase() : null;
=======
            {/* Server di kiri (bisa digeser), aksi di kanan. */}
            <div className="flex items-center gap-1 pl-1 pr-1 sm:pl-2">
              <div className="no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
                <span className="shrink-0 pl-1.5 pr-1 text-[12px] text-zinc-500">Server</span>
                <div role="group" aria-label="Pilih server video" className="flex items-center">
                  {effectiveServers.map((server, idx) => {
                    const active = idx === selectedIdx;
                    const status = serverStatus(idx, server);
>>>>>>> c5dfbd0 (Update maintennace)
                    return (
                      <button
                        key={`${server.name}-${idx}`}
                        type="button"
<<<<<<< HEAD
                        role="radio"
                        aria-checked={active}
                        disabled={!server.available}
                        onClick={() => pickManually(idx)}
                        title={`${displayServerName(server)} · ${status.label}`}
                        className={cn(
                          'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40',
                          active
                            ? 'bg-white/[0.1] text-white ring-1 ring-inset ring-white/[0.14]'
                            : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100'
                        )}
                      >
                        <span
                          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', toneClass[status.tone])}
                          aria-hidden="true"
                        />
                        <span className="whitespace-nowrap">{displayServerName(server)}</span>
                        {state ? (
                          <span className="whitespace-nowrap text-[10.5px] text-zinc-500">{state}</span>
                        ) : null}
                        {active ? <Check className="h-3 w-3 shrink-0 text-accent" aria-hidden="true" /> : null}
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
                      </button>
                    );
                  })}
                </div>
              </div>

<<<<<<< HEAD
              <div className="flex shrink-0 items-center gap-0.5 border-l border-[#2b2222] pl-1">
=======
              <div className="flex shrink-0 items-center gap-0.5 border-l border-line pl-1">
>>>>>>> c5dfbd0 (Update maintennace)
                <IconButton
                  icon={Monitor}
                  label={theater ? 'Keluar mode theater' : 'Mode theater'}
                  active={theater}
                  onClick={() => setTheater((value) => !value)}
                />
<<<<<<< HEAD
                <IconButton icon={Maximize2} label="Layar penuh" onClick={handleFullscreen} />
=======
                <IconButton icon={Maximize2} label="Layar penuh" onClick={() => void toggleFullscreen()} />
>>>>>>> c5dfbd0 (Update maintennace)
                <IconButton
                  icon={copyState === 'ok' ? Check : Copy}
                  label={copyState === 'ok' ? 'Tautan tersalin' : 'Salin tautan episode'}
                  onClick={() => void copyEpisodeUrl()}
                />
                <IconButton icon={Flag} label="Laporkan masalah pemutar" onClick={openReport} />
              </div>
            </div>

<<<<<<< HEAD
            {/* Navigasi episode: satu baris, tinggi tetap, state kosong tetap terlihat. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-t border-[#2b2222] bg-[#0a0c11] px-1 py-1 sm:px-1.5">
              <EpisodeNavButton link={navigation.prev} direction="prev" seriesTitle={seriesTitle} />
              <Link
                href={allSeriesHref}
                prefetch={false}
                title={seriesTitle ? `Semua episode ${seriesTitle}` : 'Semua episode'}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Semua episode</span>
                <span className="sr-only sm:hidden">Semua episode</span>
              </Link>
              <EpisodeNavButton link={navigation.next} direction="next" seriesTitle={seriesTitle} />
            </div>
=======
            {/* Navigasi episode: satu baris dengan tinggi tetap, state kosong tetap terlihat. */}
            <nav
              aria-label="Navigasi episode"
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-t border-line px-1 py-0.5 sm:px-2"
            >
              <EpisodeNavButton link={navigation.prev} direction="prev" seriesTitle={seriesTitle} />
              <details className="group relative">
                <summary
                  aria-label="Pilih episode"
                  title="Pilih episode"
                  className="flex h-12 cursor-pointer list-none flex-col items-center justify-center rounded-md px-2.5 transition-colors duration-150 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:h-11 [&::-webkit-details-marker]:hidden"
                >
                  <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-zinc-500">
                    Episode
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold leading-none tabular-nums text-zinc-100">
                    <List className="size-3.5 text-zinc-400" strokeWidth={1.75} aria-hidden="true" />
                    {episodePosition?.number || '—'}
                    {episodePosition ? (
                      <span className="text-[11px] font-normal text-zinc-500">/ {episodePosition.total}</span>
                    ) : null}
                  </span>
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
            </nav>
>>>>>>> c5dfbd0 (Update maintennace)

            {notice ? (
              <p
                role="status"
<<<<<<< HEAD
                className="border-t border-[#2b2222] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-400"
=======
                className="border-t border-line bg-white/[0.03] px-3 py-2 text-[12px] text-zinc-400"
>>>>>>> c5dfbd0 (Update maintennace)
              >
                {notice}
              </p>
            ) : null}
          </div>

          {theater ? (
<<<<<<< HEAD
            <p className="py-2 text-center text-[10.5px] text-zinc-500">
=======
            <p className="py-2 text-center text-[11px] text-zinc-500">
>>>>>>> c5dfbd0 (Update maintennace)
              Tekan Esc atau tombol theater untuk keluar
            </p>
          ) : null}
        </div>
      </div>

<<<<<<< HEAD
      {reportOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
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
          <div className="relative w-full max-w-md rounded-t-xl bg-[#131010] p-4 sm:rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="report-title" className="text-[13.5px] font-semibold text-white">
                  Laporkan masalah pemutar
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                  Salin detail di bawah, lalu kirim ke channel WhatsApp pengelola supaya bisa dicek.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                aria-label="Tutup"
                className="-mr-1 -mt-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200"
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
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-[12px] font-semibold text-black transition-colors duration-150 hover:bg-white/85"
              >
                {reportCopied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {reportCopied ? 'Detail tersalin' : 'Salin detail'}
              </button>
              <a
                href={CREDITS[0]?.channelUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Buka WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="ml-auto inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-[12px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-zinc-200"
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
=======
      {reportText !== null ? <ReportDialog text={reportText} onClose={closeReport} /> : null}
    </>
  );
}
>>>>>>> c5dfbd0 (Update maintennace)
