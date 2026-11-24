import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { getMalzEpisodes, malzToEpisodeSummary } from '@/lib/malz';

export async function GET(req: NextRequest) {
=======
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
import { getMalzEpisodes, malzToEpisodeSummary } from '@/lib/malz';

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: 'malz-episodes', limit: 60, windowSeconds: 60 });
  if (limited) return limited;

>>>>>>> c5dfbd0 (Update maintennace)
  const { searchParams } = req.nextUrl;
  const id = (searchParams.get('id') || '').trim();
  const pageRaw = Number(searchParams.get('page') || '0');
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.trunc(pageRaw) : 0;

  if (!id) {
    return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 });
  }

  try {
    const data = await getMalzEpisodes(id, page);
    return NextResponse.json(
      {
        page,
        items: data.items.map(malzToEpisodeSummary),
        hasMore: data.items.length >= data.perHalaman,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
    );
  } catch (error) {
<<<<<<< HEAD
    const message = error instanceof Error ? error.message : 'Gagal memuat episode';
    return NextResponse.json({ error: message }, { status: 502 });
=======
    return upstreamFailure('malz-episodes', error, 'Daftar episode sedang tidak tersedia. Coba lagi sebentar lagi.');
>>>>>>> c5dfbd0 (Update maintennace)
  }
}
