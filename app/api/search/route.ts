import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
import { quickSearch } from '@/lib/scraper';
import type { PaginationInfo, QuickSearchItem } from '@/lib/scraper/types';
import { getMalzSearch, malzToQuickItem } from '@/lib/malz';
import { nekopoiIsHentaiItem, nekopoiToQuickItem, searchNekopoiCatalog } from '@/lib/nekopoi';
import {
  getHidoriTitleIndex,
  mergeQuickSearchResults,
  searchAcrossSources,
} from '@/lib/sources';

import { filmCatalog } from '@/lib/films';

const QUICK_MALZ_LIMIT = 8;
const QUICK_ADULT_LIMIT = 8;
const QUICK_TOTAL_LIMIT = 14;

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

/**
 * Hasil Nekopoi untuk dialog pencarian. Hanya dipanggil dari halaman /hentai
 * (parameter adult=1), supaya judul dewasa tidak pernah muncul di pencarian
 * katalog utama.
 */
async function searchAdultQuick(query: string) {
  try {
    const { items } = await searchNekopoiCatalog(query, 1);
    return items
      .filter(nekopoiIsHentaiItem)
      .slice(0, QUICK_ADULT_LIMIT)
      .map(nekopoiToQuickItem);
  } catch {
    // Bagian dewasa tidak boleh menggagalkan pencarian utama.
    return [];
  }
}

async function mergeQuickResults(query: string, hidori: QuickSearchItem[]) {
  const [index, malzItems] = await Promise.all([
    getHidoriTitleIndex(),
    getMalzSearch(query, 0, 'views'),
  ]);

  return mergeQuickSearchResults(hidori, malzItems.map(malzToQuickItem), index, QUICK_MALZ_LIMIT);
}

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: 'search', limit: 60, windowSeconds: 60 });
  if (limited) return limited;

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
      const adult = searchParams.get('adult') === '1';
      const [merged, adultItems, films] = await Promise.all([
        quickSearch(q).then(items => mergeQuickResults(q, items)).catch(() => []),
        adult ? searchAdultQuick(q) : Promise.resolve([]),
        adult ? Promise.resolve([]) : filmCatalog(q).then(({ cards }) => cards.slice(0, 4).map(card => ({
          ...card, postId: card.slug, url: '/film/' + card.slug, kind: 'anime' as const,
          type: 'Movie', source: 'lk21' as const, genres: [],
        }))),
      ]);
      const results = [...adultItems, ...merged].slice(0, QUICK_TOTAL_LIMIT - films.length).concat(films);
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
    return upstreamFailure('search', error, 'Pencarian sedang tidak tersedia. Coba lagi sebentar lagi.');
  }
}
