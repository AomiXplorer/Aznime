import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
=======
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
>>>>>>> c5dfbd0 (Update maintennace)
import { getAnimeList } from '@/lib/scraper';
import {
  MALZ_PAGE_BASE,
  getMalzArchivePool,
  isMalzPoolPage,
  supplementWithArchive,
  toMalzPoolPage,
  toVirtualMalzPage,
} from '@/lib/sources';
import type { PaginationInfo } from '@/lib/scraper/types';

const ARCHIVE_PAGE_SIZE = 24;

function archivePagination(currentPage: number, poolLength: number, served: number): PaginationInfo {
  const servedTotal = (toMalzPoolPage(currentPage) + 1) * ARCHIVE_PAGE_SIZE;
  const hasNextPage = servedTotal < poolLength;
  return {
    currentPage,
    totalPages: Math.ceil(poolLength / ARCHIVE_PAGE_SIZE),
    hasNextPage,
    hasPrevPage: true,
    nextPage: hasNextPage ? toVirtualMalzPage(toMalzPoolPage(currentPage) + 1) : null,
    prevPage: currentPage > MALZ_PAGE_BASE + 1 ? currentPage - 1 : null,
  };
}

export async function GET(req: NextRequest) {
<<<<<<< HEAD
=======
  const limited = await rateLimitGuard(req, { name: 'anime', limit: 120, windowSeconds: 60 });
  if (limited) return limited;

>>>>>>> c5dfbd0 (Update maintennace)
  try {
    const { searchParams } = req.nextUrl;
    const pageRaw = Number(searchParams.get('page') || '1');
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const sub = searchParams.get('sub') || undefined;
    const order = searchParams.get('order') || undefined;
    const genre = searchParams.getAll('genre').filter(Boolean);
    const season = searchParams.getAll('season').filter(Boolean);
    const studio = searchParams.getAll('studio').filter(Boolean);

    if (isMalzPoolPage(page)) {
      const pool = await getMalzArchivePool();
      const poolPage = toMalzPoolPage(page);
      const start = (poolPage - 1) * ARCHIVE_PAGE_SIZE;
      const results = pool.slice(start, start + ARCHIVE_PAGE_SIZE);
      return NextResponse.json(
        {
          filters: { status: '', type: '', sub: '', order: 'archive', genre: [], season: [], studio: [] },
          pagination: archivePagination(page, pool.length, results.length),
          results,
        },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      );
    }

    const data = await getAnimeList({
      page,
      status,
      type,
      sub,
      order,
      genre: genre.length ? genre : undefined,
      season: season.length ? season : undefined,
      studio: studio.length ? studio : undefined,
    });

    const filtersActive =
      Boolean(status || type || sub || genre.length || season.length || studio.length) ||
      Boolean(order && order !== 'update');

    if (filtersActive) {
      const results =
        page === 1
          ? await supplementWithArchive(data.results, { status, type, genres: genre })
          : data.results;
      return NextResponse.json(
        { ...data, results },
        { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
      );
    }

    if (data.results.length === 0) {
      const pool = await getMalzArchivePool();
      const results = pool.slice(0, ARCHIVE_PAGE_SIZE);
      return NextResponse.json(
        {
          ...data,
          results,
          pagination: results.length
            ? archivePagination(toVirtualMalzPage(1), pool.length, results.length)
            : data.pagination,
        },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      );
    }

    const pool = await getMalzArchivePool();

    return NextResponse.json(
      {
        ...data,
        pagination: {
          ...data.pagination,
          hasNextPage: data.pagination.hasNextPage || pool.length > 0,
          nextPage: data.pagination.hasNextPage
            ? data.pagination.nextPage
            : pool.length > 0
              ? toVirtualMalzPage(1)
              : null,
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    );
  } catch (error) {
<<<<<<< HEAD
    const message = error instanceof Error ? error.message : 'Gagal memuat katalog anime';
    return NextResponse.json({ error: message }, { status: 502 });
=======
    return upstreamFailure('anime', error, 'Katalog sedang tidak tersedia. Coba lagi sebentar lagi.');
>>>>>>> c5dfbd0 (Update maintennace)
  }
}
