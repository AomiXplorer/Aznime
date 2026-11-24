import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { getFilterOptions } from '@/lib/scraper';

export async function GET() {
=======
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
import { getFilterOptions } from '@/lib/scraper';

export async function GET(request: Request) {
  const limited = await rateLimitGuard(request, { name: 'filters', limit: 60, windowSeconds: 60 });
  if (limited) return limited;

>>>>>>> c5dfbd0 (Update maintennace)
  try {
    const options = await getFilterOptions();
    return NextResponse.json(options, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
<<<<<<< HEAD
    const message = error instanceof Error ? error.message : 'Gagal memuat opsi filter';
    return NextResponse.json({ error: message }, { status: 502 });
=======
    return upstreamFailure('filters', error, 'Opsi filter sedang tidak tersedia. Coba lagi sebentar lagi.');
>>>>>>> c5dfbd0 (Update maintennace)
  }
}
