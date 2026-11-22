import { NextRequest, NextResponse } from 'next/server';
import { quickSearch } from '@/lib/scraper';
import type { PaginationInfo, QuickSearchItem } from '@/lib/scraper/types';
import { getMalzSearch, malzToQuickItem } from '@/lib/malz';
import {
  getHidoriTitleIndex,
  mergeQuickSearchResults,
  searchAcrossSources,
} from '@/lib/sources';

const QUICK_MALZ_LIMIT = 8;

function emptyPagination(): PaginationInfo {
  return {
    currentPage: 1,
    totalPages: null,
    hasNextPage: false,
    hasPrevPage: false,
    nextPage: null,
    prevPage: null,
  };
}

async function mergeQuickResults(query: string, hidori: QuickSearchItem[]) {
  const [index, malzItems] = await Promise.all([
    getHidoriTitleIndex(),
    getMalzSearch(query, 0, 'views'),
  ]);

  return mergeQuickSearchResults(hidori, malzItems.map(malzToQuickItem), index, QUICK_MALZ_LIMIT);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = (searchParams.get('q') || '').trim();
    const mode = searchParams.get('mode') === 'full' ? 'full' : 'quick';

    if (!q) {
      return NextResponse.json(
        mode === 'quick'
          ? { query: '', results: [] }
          : { query: '', pagination: emptyPagination(), results: [] }
      );
    }

    if (q.length > 100) {
      return NextResponse.json({ error: 'Kata kunci maksimal 100 karakter' }, { status: 400 });
    }

    if (mode === 'quick') {
      const hidori = await quickSearch(q);
      const results = await mergeQuickResults(q, hidori);
      return NextResponse.json(
        { query: q, results },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
          },
        }
      );
    }

    const pageRaw = Number(searchParams.get('page') || '1');
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

    const data = await searchAcrossSources(q, page);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mencari anime';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
