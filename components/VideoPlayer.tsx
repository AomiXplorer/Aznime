'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Hls from 'hls.js';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  Maximize2,
  Zap,
} from 'lucide-react';
import type { EpisodeNavLink, MirrorServer } from '@/lib/scraper/types';

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
}

/** Batas waktu satu pengukuran server. */
const PROBE_TIMEOUT_MS = 4000;
/** Server direct (HLS/MP4) boleh kalah segini dari iframe tercepat dan tetap dipilih. */
const DIRECT_GRACE_MS = 250;
/** Jika server terpilih belum selesai dimuat sampai batas ini, pindah otomatis. */
const STALL_MS = 10000;

const isDirect = (s: MirrorServer) => s.type === 'hls' || s.type === 'video';

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

export function VideoPlayer({
  title,
  servers,
  defaultEmbed,
  navigation,
  seriesSlug,
}: VideoPlayerProps) {
  const effectiveServers = useMemo<MirrorServer[]>(() => {
    if (servers.length > 0) return servers;
    if (defaultEmbed) {
      return [
        {
          name: 'Server Utama',
          available: true,
          type: /\.m3u8(\?|$)/i.test(defaultEmbed) ? 'hls' : 'iframe',
          url: defaultEmbed,
        },
      ];
    }
    return [];
  }, [servers, defaultEmbed]);

  const playable = useMemo(
    () =>
      effectiveServers
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.available && Boolean(s.url)),
    [effectiveServers]
  );

  // Cadangan bila pengukuran gagal total: server direct pertama, atau server tersedia pertama.
  const fallbackIdx = useMemo(() => {
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

  const manualRef = useRef(false);
  const triedRef = useRef<Set<number>>(new Set());
  const latencyRef = useRef<Record<number, number | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeServer = selectedIdx !== null ? effectiveServers[selectedIdx] || null : null;
  const racing = selectedIdx === null;

  // Pindah ke server tercepat berikutnya yang belum dicoba (hanya jika pengguna belum memilih manual).
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
      setNotice(`${reason} Pindah ke ${effectiveServers[next].name}.`);
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
        const score = ms - (isDirect(s) ? DIRECT_GRACE_MS : 0);
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
          else if (!graceTimer) graceTimer = setTimeout(decide, DIRECT_GRACE_MS);
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

    const fail = (message: string) => {
      setIsLoading(false);
      if (!advanceToNext(`${activeServer.name} gagal diputar.`)) setMediaError(message);
    };

    let hls: Hls | null = null;
    if (activeServer.type === 'hls' || /\.m3u8(\?|$)/i.test(activeServer.url)) {
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = activeServer.url;
      } else if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(activeServer.url);
        hls.attachMedia(videoEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => setIsLoading(false));
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) fail('Stream HLS gagal dimuat. Pilih server lain di bawah.');
        });
      } else {
        fail('Browser Anda tidak mendukung pemutaran HLS pada server ini.');
      }
    } else {
      videoEl.src = activeServer.url;
    }

    return () => {
      hls?.destroy();
      videoEl.removeAttribute('src');
      videoEl.load();
    };
  }, [activeServer, advanceToNext]);

  // 3) Jika server terpilih macet, pindah otomatis.
  useEffect(() => {
    if (!activeServer || !isLoading || manualRef.current) return;
    const t = setTimeout(() => {
      advanceToNext(`${activeServer.name} terlalu lama dimuat.`);
    }, STALL_MS);
    return () => clearTimeout(t);
  }, [activeServer, isLoading, advanceToNext]);

  // Pintasan keyboard untuk mode video langsung.
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
        else void containerRef.current?.requestFullscreen();
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

  const handleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  };

  const pickManually = (idx: number) => {
    manualRef.current = true;
    setNotice(null);
    setSelectedIdx(idx);
  };

  const allSeriesHref = navigation.all?.slug
    ? `/anime/${encodeURIComponent(navigation.all.slug)}`
    : seriesSlug
      ? `/anime/${encodeURIComponent(seriesSlug)}`
      : '/anime';

  const navBtn =
    'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';
  const navBtnOff = 'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-zinc-600';

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10"
      >
        {racing ? (
          <div role="status" aria-live="polite" className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-sm font-semibold text-zinc-200">Mencari server tercepat</p>
            <p className="text-xs text-muted">
              {Object.keys(latencies).length} dari {playable.length} server merespons
            </p>
          </div>
        ) : !activeServer || !activeServer.available || !activeServer.url ? (
          <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="mb-2 h-7 w-7 text-rose-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-zinc-200">
              {activeServer?.message || 'Belum ada sumber video untuk episode ini.'}
            </p>
            <p className="mt-1 text-xs text-muted">Pilih server lain atau pakai tautan unduhan di bawah.</p>
          </div>
        ) : mediaError ? (
          <div role="alert" className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="mb-2 h-7 w-7 text-rose-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-zinc-200">{mediaError}</p>
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
              if (!advanceToNext(`${activeServer.name} gagal diputar.`)) {
                setMediaError('Video gagal diputar dari server ini. Coba server lain.');
              }
            }}
            className="h-full w-full bg-black"
          />
        ) : (
          <iframe
            key={activeServer.url}
            src={activeServer.url}
            title={`Pemutar ${title} - ${activeServer.name}`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoading(false)}
            className="h-full w-full border-0"
          />
        )}

        {!racing && isLoading && activeServer?.available && activeServer?.url && !mediaError ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55"
          >
            <div className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-xs font-semibold text-zinc-200 ring-1 ring-white/10">
              <Loader2 className="h-4 w-4 animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />
              Memuat {activeServer.name}
            </div>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="rounded-lg bg-amber-500/10 px-3.5 py-2 text-[13px] text-amber-200">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {navigation.prev?.slug ? (
            <Link
              href={`/watch/${encodeURIComponent(navigation.prev.slug)}`}
              className={`${navBtn} bg-white/[0.07] text-zinc-100 hover:bg-white/[0.14]`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Sebelumnya
            </Link>
          ) : (
            <span className={navBtnOff}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Sebelumnya
            </span>
          )}

          <Link href={allSeriesHref} className={`${navBtn} bg-white/[0.07] text-zinc-100 hover:bg-white/[0.14]`}>
            <List className="h-4 w-4" aria-hidden="true" />
            Semua episode
          </Link>

          {navigation.next?.slug ? (
            <Link
              href={`/watch/${encodeURIComponent(navigation.next.slug)}`}
              className={`${navBtn} bg-white text-black hover:bg-white/85`}
            >
              Berikutnya
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className={navBtnOff}>
              Berikutnya
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleFullscreen}
          aria-label="Layar penuh"
          className={`${navBtn} cursor-pointer bg-white/[0.07] text-zinc-100 hover:bg-white/[0.14]`}
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Layar penuh</span>
        </button>
      </div>

      {effectiveServers.length > 0 ? (
        <div className="rounded-xl bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-white">Server</h2>
            <span className="text-xs text-muted">
              {activeServer && isDirect(activeServer)
                ? 'Spasi putar/jeda, F layar penuh, M bisu, panah untuk geser'
                : 'Jika video tidak muncul, coba server lain'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Server video">
            {effectiveServers.map((srv, idx) => {
              const isSelected = idx === selectedIdx;
              const ms = latencies[idx];
              const isFastest = autoIdx === idx;
              return (
                <button
                  key={`${srv.name}-${idx}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={!srv.available}
                  onClick={() => pickManually(idx)}
                  className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected ? 'bg-accent-strong text-white' : 'bg-white/[0.07] text-zinc-200 hover:bg-white/[0.14]'
                  }`}
                >
                  <span>{srv.name}</span>
                  {isFastest ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold">
                      <Zap className="h-3 w-3 fill-current" aria-hidden="true" />
                      Tercepat
                    </span>
                  ) : null}
                  <span className="text-[11px] font-medium opacity-70">
                    {!srv.available
                      ? 'Offline'
                      : typeof ms === 'number'
                        ? `${ms} ms`
                        : ms === null
                          ? 'Lambat'
                          : isDirect(srv)
                            ? 'Direct'
                            : 'Embed'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
