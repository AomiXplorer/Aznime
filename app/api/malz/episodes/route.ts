import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
import { getMalzEpisodes, malzToEpisodeSummary } from '@/lib/malz';

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: 'malz-episodes', limit: 60, windowSeconds: 60 });
  if (limited) return limited;

  const { searchParams } = req.nextUrl;
  const id = (searchParams.get('id') || '').trim();
  const pageRaw = Number(searchParams.get('page') || '0');
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.trunc(pageRaw) : 0;
  const title = (searchParams.get('title') || '').trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 });
  }

  try {
    const data = await getMalzEpisodes(id, page);
    return NextResponse.json(
      {
        page,
        items: data.items.map((episode) => malzToEpisodeSummary(episode, title)),
        hasMore: data.items.length >= data.perHalaman,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
    );
  } catch (error) {
    return upstreamFailure('malz-episodes', error, 'Daftar episode sedang tidak tersedia. Coba lagi sebentar lagi.');
  }
}
