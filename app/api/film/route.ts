import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGuard } from '@/lib/api-guard';
import { getMovies, toAnimeCardItem } from '@/lib/scrapers';

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: 'film', limit: 120, windowSeconds: 60 });
  if (limited) return limited;

  const pageRaw = Number(req.nextUrl.searchParams.get('page') || '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

  const feed = await getMovies({ page });
  const results = feed.items.map(toAnimeCardItem);

  return NextResponse.json(
    {
      results,
      pagination: feed.pagination,
      offline: feed.offline,
      ...(feed.error ? { error: feed.error } : {}),
    },
    {
      headers: {
        'Cache-Control': feed.offline
          ? 'no-store, no-cache, must-revalidate'
          : 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
