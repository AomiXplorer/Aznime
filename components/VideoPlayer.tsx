'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type HlsType from 'hls.js';
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

/** Server yang selalu dipakai lebih dulu saat episode dibuka. */
const DEFAULT_SERVER = 'vastads';
/** Jika server terpilih belum selesai dimuat sampai batas ini, pindah otomatis. */
const STALL_MS = 12000;

const isDirect = (s: MirrorServer) => s.type === 'hls' || s.type === 'video';

const normalizeServerName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '');

const isDefaultServer = (s: MirrorServer) => {
  const name = normalizeServerName(s.name);
  return name === DEFAULT_SERVER || name.startsWith(DEFAULT_SERVER);
};

export function VideoPlayer({
  title,
  servers,
  defaultEmbed,
  navigation,
  seriesSlug,
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

    // vastads selalu di depan supaya jadi default dan gampang ditemukan.
    const list = [...base];
    const idx = list.findIndex(isDefaultServer);
    if (idx > 0) {
      const [preferred] = list.splice(idx, 1);
      list.unshift(preferred);
    }
    return list;
  }, [servers, defaultEmbed]);

  const playable = useMemo(
    () =>
      effectiveServers
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.available && Boolean(s.url)),
    [effectiveServers]
  );

  // Cadangan bila vastads tidak tersedia: server direct pertama, lalu server apa pun.
  const defaultIdx = useMemo(() => {
    const preferred = playable.find(({ s }) => isDefaultServer(s));
    if (preferred) return preferred.i;
    const direct = playable.find(({ s }) => isDirect(s));
    if (direct) return direct.i;
    return playable[0]?.i ?? 0;
  }, [playable]);

  const [selectedIdx, setSelectedIdx] = useState<number>(defaultIdx);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const manualRef = useRef(false);
  const triedRef = useRef<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeServer = effectiveServers[selectedIdx] || null;

  // Setiap episode punya daftar server baru: mulai lagi dari vastads.
  const serverSignature = useMemo(
    () => effectiveServers.map((s) => `${s.name}:${s.url ?? ''}`).join('|'),
    [effectiveServers]
  );

  useEffect(() => {
    manualRef.current = false;
    triedRef.current = new Set([defaultIdx]);
    setSelectedIdx(defaultIdx);
    setNotice(null);
    setMediaError(null);
  }, [defaultIdx, serverSignature]);

  // Pindah ke server berikutnya yang belum dicoba (hanya jika pengguna belum memilih manual).
  const advanceToNext = useCallback(
    (reason: string): boolean => {
      if (manualRef.current) return false;
      const next = playable.map((p) => p.i).find((i) => !triedRef.current.has(i));
      if (next === undefined) return false;
      triedRef.current.add(next);
      setNotice(`${reason} Pindah ke ${effectiveServers[next].name}.`);
      setSelectedIdx(next);
      return true;
    },
    [playable, effectiveServers]
  );

  // Muat server aktif (HLS / video langsung / iframe).
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

    let cancelled = false;
    let hls: HlsType | null = null;
    const url = activeServer.url;

    const fail = (message: string) => {
      if (cancelled) return;
      setIsLoading(false);
      if (!advanceToNext(`${activeServer.name} gagal diputar.`)) setMediaError(message);
    };

    const wantsHls = activeServer.type === 'hls' || /\.m3u8(\?|$)/i.test(url);

    if (!wantsHls || videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
    } else {
      // hls.js hanya diunduh saat benar-benar dibutuhkan, bukan saat halaman dibuka.
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
  }, [activeServer, advanceToNext]);

  // Jika server terpilih macet, pindah otomatis.
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
    triedRef.current.add(idx);
    setNotice(null);
    setMediaError(null);
    setSelectedIdx(idx);
  };

  const allSeriesHref = navigation.all?.slug
    ? `/anime/${encodeURIComponent(navigation.all.slug)}`
    : seriesSlug
      ? `/anime/${encodeURIComponent(seriesSlug)}`
      : '/anime';

  const navBtn =
    'inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';
  const navBtnOff = 'inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[13px] font-semibold text-zinc-600';

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10"
      >
        {!activeServer || !activeServer.available || !activeServer.url ? (
          <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="mb-2 h-7 w-7 text-accent-ink" aria-hidden="true" />
            <p className="text-sm font-semibold text-zinc-200">
              {activeServer?.message || 'Belum ada sumber video untuk episode ini.'}
            </p>
            <p className="mt-1 text-xs text-muted">Pilih server lain atau pakai tautan unduhan di bawah.</p>
          </div>
        ) : mediaError ? (
          <div role="alert" className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="mb-2 h-7 w-7 text-accent-ink" aria-hidden="true" />
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

        {isLoading && activeServer?.available && activeServer?.url && !mediaError ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55"
          >
            <div className="flex items-center gap-2 rounded-md bg-surface px-4 py-2 text-xs font-semibold text-zinc-200 ring-1 ring-white/10">
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
              prefetch={false}
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

          <Link
            href={allSeriesHref}
            prefetch={false}
            className={`${navBtn} bg-white/[0.07] text-zinc-100 hover:bg-white/[0.14]`}
          >
            <List className="h-4 w-4" aria-hidden="true" />
            Semua episode
          </Link>

          {navigation.next?.slug ? (
            <Link
              href={`/watch/${encodeURIComponent(navigation.next.slug)}`}
              prefetch={false}
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
                : 'Default di vastads. Kalau macet, pindah server di bawah.'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Server video">
            {effectiveServers.map((srv, idx) => {
              const isSelected = idx === selectedIdx;
              const isDefault = isDefaultServer(srv);
              return (
                <button
                  key={`${srv.name}-${idx}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={!srv.available}
                  onClick={() => pickManually(idx)}
                  className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 text-[13px] font-semibold transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected ? 'bg-accent-strong text-white' : 'bg-white/[0.07] text-zinc-200 hover:bg-white/[0.14]'
                  }`}
                >
                  <span>{srv.name}</span>
                  {isDefault ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-bold">
                      <Zap className="h-3 w-3 fill-current" aria-hidden="true" />
                      Default
                    </span>
                  ) : null}
                  <span className="text-[11px] font-medium opacity-70">
                    {!srv.available ? 'Offline' : isDirect(srv) ? 'Direct' : 'Embed'}
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
