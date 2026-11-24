import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
import { getMalzMinimumEpisode } from '@/lib/malz';

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: 'malz-minimum', limit: 30, windowSeconds: 60 });
  if (limited) return limited;

  const { searchParams } = req.nextUrl;
  const id = (searchParams.get('id') || '').trim();
  const highest = Number(searchParams.get('highest'));
  const perPage = Number(searchParams.get('perPage'));

  if (!id || !Number.isFinite(highest) || !Number.isFinite(perPage) || perPage <= 0) {
    return NextResponse.json({ error: 'Parameter id, highest, dan perPage wajib valid' }, { status: 400 });
  }

  try {
    const minimumEpisode = await getMalzMinimumEpisode(id, highest, perPage);
    return NextResponse.json(
      { minimumEpisode },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
    );
  } catch (error) {
    return upstreamFailure(
      'malz-minimum',
      error,
      'Rentang episode belum bisa diperiksa. Coba lagi sebentar lagi.'
    );
  }
}
