import { NextRequest, NextResponse } from 'next/server';
import { getAnimeList } from '@/lib/scraper';

export async function GET(req: NextRequest) {
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

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat katalog anime';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
