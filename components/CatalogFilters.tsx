'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, RotateCcw, Search, X } from 'lucide-react';
import type { FilterOptionItem, FilterOptionsMap } from '@/lib/scraper/types';
import { cn } from '@/lib/cn';

export interface CatalogFilterState {
  status: string;
  type: string;
  order: string;
  genres: string[];
}

interface CatalogFiltersProps {
  options: FilterOptionsMap;
  current: CatalogFilterState;
  basePath?: string;
}

type PanelKey = 'status' | 'type' | 'genre' | 'order';

const STATUS_LABELS: Record<string, string> = {
  '': 'Semua status',
  ongoing: 'Sedang tayang',
  completed: 'Sudah tamat',
  upcoming: 'Segera tayang',
  hiatus: 'Hiatus',
};

const TYPE_LABELS: Record<string, string> = {
  '': 'Semua tipe',
  tv: 'TV Series',
  movie: 'Movie',
  ova: 'OVA',
  ona: 'ONA',
  special: 'Special',
  bd: 'BD',
  music: 'Music',
  'live action': 'Live Action',
};

const ORDER_LABELS: Record<string, string> = {
  update: 'Terbaru',
  latest: 'Baru ditambahkan',
  popular: 'Populer',
  rating: 'Rating tertinggi',
  title: 'A–Z',
  titlereverse: 'Z–A',
};

const FALLBACK_STATUS: FilterOptionItem[] = [
  { label: 'Semua status', value: '' },
  { label: 'Sedang tayang', value: 'ongoing' },
  { label: 'Sudah tamat', value: 'completed' },
  { label: 'Segera tayang', value: 'upcoming' },
];

const FALLBACK_TYPE: FilterOptionItem[] = [
  { label: 'Semua tipe', value: '' },
  { label: 'TV Series', value: 'tv' },
  { label: 'Movie', value: 'movie' },
  { label: 'OVA', value: 'ova' },
  { label: 'ONA', value: 'ona' },
];

const FALLBACK_ORDER: FilterOptionItem[] = [
  { label: 'Terbaru', value: 'update' },
  { label: 'Populer', value: 'popular' },
  { label: 'Rating tertinggi', value: 'rating' },
  { label: 'A–Z', value: 'title' },
];

const PANEL_COPY: Record<PanelKey, { title: string; hint?: string }> = {
  status: { title: 'Mau yang mana?', hint: 'Status tayang anime.' },
  type: { title: 'Pilih tipe', hint: 'Format tayangnya.' },
  genre: { title: 'Pilih genre', hint: 'Boleh pilih lebih dari satu.' },
  order: { title: 'Urutkan katalog', hint: 'Dari yang paling pas buat kamu.' },
};

/** Rapikan label upstream jadi bahasa yang enak dibaca, tanpa menghapus nilai aslinya. */
function prepare(
  options: FilterOptionItem[] | undefined,
  fallback: FilterOptionItem[],
  labels: Record<string, string>
): FilterOptionItem[] {
  const list = options && options.length > 0 ? options : fallback;
  const seen = new Set<string>();
  const result: FilterOptionItem[] = [];

  for (const item of list) {
    if (seen.has(item.value)) continue;
    seen.add(item.value);
    result.push({
      value: item.value,
      label: labels[item.value] ?? item.label,
    });
  }

  return result;
}

export function CatalogFilters({ options, current, basePath = '/anime' }: CatalogFiltersProps) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<PanelKey | null>(null);
  const [draftGenres, setDraftGenres] = useState<string[]>(current.genres);
  const [genreQuery, setGenreQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const statusItems = useMemo(
    () => prepare(options.status, FALLBACK_STATUS, STATUS_LABELS),
    [options.status]
  );

  const typeItems = useMemo(
    () => prepare(options.type, FALLBACK_TYPE, TYPE_LABELS),
    [options.type]
  );

  const orderItems = useMemo(() => {
    const list = prepare(options.order, FALLBACK_ORDER, ORDER_LABELS).filter(
      (item) => item.value !== ''
    );
    if (!list.some((item) => item.value === 'update')) {
      list.unshift({ label: ORDER_LABELS.update, value: 'update' });
    }
    return list;
  }, [options.order]);

  const genreItems = useMemo(
    () => prepare(options.genre, [], {}).filter((item) => item.value !== ''),
    [options.genre]
  );

  const activeGenreSet = useMemo(() => new Set(current.genres), [current.genres]);

  const genreLabel = useMemo(() => {
    if (current.genres.length === 0) return 'Semua';
    if (current.genres.length === 1) {
      const found = genreItems.find((item) => item.value === current.genres[0]);
      return found?.label ?? '1 genre';
    }
    return `${current.genres.length} genre`;
  }, [current.genres, genreItems]);

  const orderLabel = useMemo(
    () => ORDER_LABELS[current.order] ?? current.order ?? ORDER_LABELS.update,
    [current.order]
  );

  const activeCount =
    (current.status ? 1 : 0) +
    (current.type ? 1 : 0) +
    current.genres.length +
    (current.order && current.order !== 'update' ? 1 : 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    const key = openKey;
    setOpenKey(null);
    setGenreQuery('');
    if (key) {
      window.setTimeout(() => triggerRefs.current[key]?.focus(), 0);
    }
  }, [openKey]);

  // Esc untuk menutup, dan kunci scroll body selama panel terbuka.
  useEffect(() => {
    if (!openKey) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openKey, close]);

  const pushState = useCallback(
    (next: CatalogFilterState) => {
      const sp = new URLSearchParams();
      if (next.status) sp.set('status', next.status);
      if (next.type) sp.set('type', next.type);
      if (next.order) sp.set('order', next.order);
      for (const genre of next.genres) {
        if (genre) sp.append('genre', genre);
      }
      const qs = sp.toString();
      router.push(`${basePath}${qs ? `?${qs}` : ''}`);
    },
    [basePath, router]
  );

  const chooseSingle = useCallback(
    (key: 'status' | 'type' | 'order', value: string) => {
      const next: CatalogFilterState = {
        status: current.status,
        type: current.type,
        order: current.order,
        genres: current.genres,
      };
      if (key === 'status') next.status = value;
      if (key === 'type') next.type = value;
      if (key === 'order') next.order = value;
      pushState(next);
      close();
    },
    [close, current, pushState]
  );

  const openPanel = (key: PanelKey) => {
    if (key === 'genre') {
      setDraftGenres(current.genres);
      setGenreQuery('');
    }
    setOpenKey(key);
  };

  const toggleGenre = (value: string) => {
    setDraftGenres((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const applyGenres = () => {
    pushState({
      status: current.status,
      type: current.type,
      order: current.order,
      genres: draftGenres,
    });
    close();
  };

  const resetAll = () => {
    router.push(basePath);
  };

  const filteredGenres = useMemo(() => {
    const q = genreQuery.trim().toLowerCase();
    if (!q) return genreItems;
    return genreItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [genreItems, genreQuery]);

  const triggerClass = (active: boolean) =>
    cn(
      'inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98]',
      active
        ? 'border-accent/50 bg-accent/15 text-white'
        : 'border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.09]'
    );

  const triggerLabelClass = 'text-[11px] font-medium uppercase tracking-wide text-zinc-500';

  // Di baris chip, "Semua" sudah cukup jelas; label panjang dipakai di dalam panel.
  const shortValue = (value: string, fallback: string) => (value ? fallback : 'Semua');

  const optionRowClass = (selected: boolean) =>
    cn(
      'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-[14px] transition-colors duration-150',
      selected
        ? 'bg-accent/15 font-semibold text-white'
        : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
    );

  const currentSingle =
    openKey === 'status' ? current.status : openKey === 'type' ? current.type : current.order;

  const panelBody = () => {
    if (openKey === 'genre') {
      return (
        <>
          <div className="px-4 pb-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={genreQuery}
                onChange={(event) => setGenreQuery(event.target.value)}
                placeholder="Cari genre, misal romance"
                aria-label="Cari genre"
                className="h-11 w-full rounded-xl border border-white/10 bg-canvas pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/60"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {filteredGenres.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                Genre &ldquo;{genreQuery}&rdquo; nggak ketemu. Coba kata lain ya.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredGenres.map((item) => {
                  const selected = draftGenres.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleGenre(item.value)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors duration-150 active:scale-[0.97]',
                        selected
                          ? 'border-accent/60 bg-accent/20 text-white'
                          : 'border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]'
                      )}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3">
            <button
              type="button"
              onClick={() => setDraftGenres([])}
              disabled={draftGenres.length === 0}
              className="cursor-pointer rounded-md px-3 py-2 text-[13px] font-semibold text-zinc-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Bersihkan
            </button>
            <button
              type="button"
              onClick={applyGenres}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-accent px-5 text-[13px] font-bold text-white transition-colors hover:bg-accent-hover active:scale-[0.98]"
            >
              Terapkan
              {draftGenres.length > 0 ? (
                <span className="rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] font-bold">
                  {draftGenres.length}
                </span>
              ) : null}
            </button>
          </div>
        </>
      );
    }

    const items =
      openKey === 'status' ? statusItems : openKey === 'type' ? typeItems : orderItems;

    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3" role="listbox" aria-label={PANEL_COPY[openKey!].title}>
        {items.map((item) => {
          const selected = currentSingle === item.value;
          return (
            <button
              key={item.value || 'all'}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => chooseSingle(openKey as 'status' | 'type' | 'order', item.value)}
              className={optionRowClass(selected)}
            >
              <span>{item.label}</span>
              {selected ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface p-3">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        <button
          type="button"
          ref={(node) => {
            triggerRefs.current.status = node;
          }}
          onClick={() => openPanel('status')}
          aria-haspopup="dialog"
          aria-expanded={openKey === 'status'}
          className={triggerClass(Boolean(current.status))}
        >
          <span className={triggerLabelClass}>Status</span>
          <span>{shortValue(current.status, STATUS_LABELS[current.status] ?? current.status)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>

        <button
          type="button"
          ref={(node) => {
            triggerRefs.current.type = node;
          }}
          onClick={() => openPanel('type')}
          aria-haspopup="dialog"
          aria-expanded={openKey === 'type'}
          className={triggerClass(Boolean(current.type))}
        >
          <span className={triggerLabelClass}>Tipe</span>
          <span>{shortValue(current.type, TYPE_LABELS[current.type] ?? current.type)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>

        <button
          type="button"
          ref={(node) => {
            triggerRefs.current.genre = node;
          }}
          onClick={() => openPanel('genre')}
          aria-haspopup="dialog"
          aria-expanded={openKey === 'genre'}
          className={triggerClass(current.genres.length > 0)}
        >
          <span className={triggerLabelClass}>Genre</span>
          <span>{genreLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>

        <button
          type="button"
          ref={(node) => {
            triggerRefs.current.order = node;
          }}
          onClick={() => openPanel('order')}
          aria-haspopup="dialog"
          aria-expanded={openKey === 'order'}
          className={triggerClass(Boolean(current.order && current.order !== 'update'))}
        >
          <span className={triggerLabelClass}>Urutan</span>
          <span>{orderLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[12px] font-semibold text-zinc-400 transition-colors hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-zinc-200">
              {activeCount}
            </span>
          </button>
        ) : null}
      </div>

      {current.genres.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
          {current.genres.map((value) => {
            const item = genreItems.find((entry) => entry.value === value);
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  pushState({
                    status: current.status,
                    type: current.type,
                    order: current.order,
                    genres: current.genres.filter((entry) => entry !== value),
                  })
                }
                aria-label={`Hapus genre ${item?.label ?? value}`}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
              >
                {item?.label ?? value}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}

      {mounted && openKey
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
              <button
                type="button"
                aria-label="Tutup pilihan filter"
                onClick={close}
                className="picker-backdrop absolute inset-0 cursor-default bg-black/70"
              />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-panel-title"
                tabIndex={-1}
                className="picker-sheet relative flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/[0.08] bg-surface shadow-2xl shadow-black/60 outline-none sm:max-w-md sm:rounded-3xl"
              >
                <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
                  <div>
                    <h2 id="filter-panel-title" className="text-[15px] font-bold text-white">
                      {PANEL_COPY[openKey].title}
                    </h2>
                    {PANEL_COPY[openKey].hint ? (
                      <p className="mt-0.5 text-[12px] text-zinc-500">{PANEL_COPY[openKey].hint}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Tutup"
                    className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white/[0.06] text-zinc-300 transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {openKey === 'genre' ? null : <div className="h-1" />}

                {panelBody()}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
