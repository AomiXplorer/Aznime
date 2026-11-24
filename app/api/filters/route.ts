import { NextResponse } from 'next/server';
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
import { getFilterOptions } from '@/lib/scraper';

export async function GET(request: Request) {
  const limited = await rateLimitGuard(request, { name: 'filters', limit: 60, windowSeconds: 60 });
  if (limited) return limited;

  try {
    const options = await getFilterOptions();
    return NextResponse.json(options, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    return upstreamFailure('filters', error, 'Opsi filter sedang tidak tersedia. Coba lagi sebentar lagi.');
  }
}
