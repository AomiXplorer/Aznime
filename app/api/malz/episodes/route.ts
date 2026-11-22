import { NextRequest, NextResponse } from 'next/server';
import { getMalzEpisodes, malzToEpisodeSummary } from '@/lib/malz';

export async function GET(req: NextRequest) {
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
    const message = error instanceof Error ? error.message : 'Gagal memuat episode';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
