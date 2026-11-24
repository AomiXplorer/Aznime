import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
=======
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
>>>>>>> c5dfbd0 (Update maintennace)
import { quickSearch } from '@/lib/scraper';
import type { PaginationInfo, QuickSearchItem } from '@/lib/scraper/types';
import { getMalzSearch, malzToQuickItem } from '@/lib/malz';
import { nekopoiIsHentaiItem, nekopoiToQuickItem, searchNekopoiCatalog } from '@/lib/nekopoi';
import {
  getHidoriTitleIndex,
  mergeQuickSearchResults,
  searchAcrossSources,
} from '@/lib/sources';

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
<<<<<<< HEAD
=======
  const limited = await rateLimitGuard(req, { name: 'search', limit: 60, windowSeconds: 60 });
  if (limited) return limited;

>>>>>>> c5dfbd0 (Update maintennace)
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
      const [hidori, adultItems] = await Promise.all([
        quickSearch(q),
        adult ? searchAdultQuick(q) : Promise.resolve([]),
      ]);
      const merged = await mergeQuickResults(q, hidori);
      const results = [...adultItems, ...merged].slice(0, QUICK_TOTAL_LIMIT);
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
<<<<<<< HEAD
    const message = error instanceof Error ? error.message : 'Gagal mencari anime';
    return NextResponse.json({ error: message }, { status: 502 });
=======
    return upstreamFailure('search', error, 'Pencarian sedang tidak tersedia. Coba lagi sebentar lagi.');
>>>>>>> c5dfbd0 (Update maintennace)
  }
}
