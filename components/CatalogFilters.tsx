'use client';

import { useRouter } from 'next/navigation';
import type { FilterOptionsMap } from '@/lib/scraper/types';

interface CatalogFiltersProps {
  options: FilterOptionsMap;
  current: {
    status: string;
    type: string;
    order: string;
    genre: string;
  };
  basePath?: string;
}

export function CatalogFilters({
  options,
  current,
  basePath = '/anime',
}: CatalogFiltersProps) {
  const router = useRouter();

  const statusItems = options.status || [
    { label: 'Semua Status', value: '' },
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Completed', value: 'completed' },
    { label: 'Upcoming', value: 'upcoming' },
  ];

  const typeItems = options.type || [
    { label: 'Semua Tipe', value: '' },
    { label: 'TV Series', value: 'tv' },
    { label: 'Movie', value: 'movie' },
    { label: 'OVA', value: 'ova' },
    { label: 'ONA', value: 'ona' },
  ];

  const orderItems = options.order || [
    { label: 'Terbaru Update', value: 'update' },
    { label: 'Populer', value: 'popular' },
    { label: 'Rating Tertinggi', value: 'rating' },
    { label: 'A–Z', value: 'title' },
    { label: 'Terbaru Ditambahkan', value: 'latest' },
  ];

  const genreItems = options.genre || [];

  const updateFilter = (key: 'status' | 'type' | 'order' | 'genre', value: string) => {
    const next = { ...current, [key]: value };
    const sp = new URLSearchParams();
    if (next.status) sp.set('status', next.status);
    if (next.type) sp.set('type', next.type);
    if (next.order) sp.set('order', next.order);
    if (next.genre) sp.set('genre', next.genre);
    const qs = sp.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ''}`);
  };

  const hasActiveFilter = Boolean(
    current.status || current.type || current.genre || (current.order && current.order !== 'update')
  );

  return (
    <div className="rounded-lg border border-white/10 bg-[#12141a] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="filter-status" className="block text-xs font-medium text-zinc-400">
            Status
          </label>
          <select
            id="filter-status"
            value={current.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="h-10 w-full rounded-md border border-white/15 bg-[#0a0b0e] px-3 text-sm text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
          >
            {statusItems.map((item) => (
              <option key={item.value || 'all-status'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-type" className="block text-xs font-medium text-zinc-400">
            Tipe
          </label>
          <select
            id="filter-type"
            value={current.type}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="h-10 w-full rounded-md border border-white/15 bg-[#0a0b0e] px-3 text-sm text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
          >
            {typeItems.map((item) => (
              <option key={item.value || 'all-type'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-genre" className="block text-xs font-medium text-zinc-400">
            Genre
          </label>
          <select
            id="filter-genre"
            value={current.genre}
            onChange={(e) => updateFilter('genre', e.target.value)}
            className="h-10 w-full rounded-md border border-white/15 bg-[#0a0b0e] px-3 text-sm text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
          >
            <option value="">Semua Genre</option>
            {genreItems.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-order" className="block text-xs font-medium text-zinc-400">
            Urutkan
          </label>
          <select
            id="filter-order"
            value={current.order}
            onChange={(e) => updateFilter('order', e.target.value)}
            className="h-10 w-full rounded-md border border-white/15 bg-[#0a0b0e] px-3 text-sm text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
          >
            {orderItems.map((item) => (
              <option key={item.value || 'default-order'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilter ? (
        <div className="mt-3 flex justify-end border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => router.push(basePath)}
            className="cursor-pointer text-xs font-medium text-rose-400 hover:text-rose-300 hover:underline underline-offset-4"
          >
            Reset semua filter
          </button>
        </div>
      ) : null}
    </div>
  );
}
