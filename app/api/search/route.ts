import { NextRequest, NextResponse } from 'next/server';
import { quickSearch, search } from '@/lib/scraper';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = (searchParams.get('q') || '').trim();
    const mode = searchParams.get('mode') === 'full' ? 'full' : 'quick';

    if (!q) {
      return NextResponse.json(
        mode === 'quick'
          ? { query: '', results: [] }
          : {
              query: '',
              pagination: {
                currentPage: 1,
                totalPages: null,
                hasNextPage: false,
                hasPrevPage: false,
                nextPage: null,
                prevPage: null,
              },
              results: [],
            }
      );
    }

    if (q.length > 100) {
      return NextResponse.json({ error: 'Kata kunci maksimal 100 karakter' }, { status: 400 });
    }

    if (mode === 'quick') {
      const results = await quickSearch(q);
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
    const data = await search(q, page);

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
