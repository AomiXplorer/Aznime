import { NextResponse } from 'next/server';
<<<<<<< HEAD
=======
import { rateLimitGuard, upstreamFailure } from '@/lib/api-guard';
>>>>>>> c5dfbd0 (Update maintennace)
import { nekopoiIsHentaiItem, nekopoiToCard, searchNekopoiCatalog } from '@/lib/nekopoi';

/**
 * Pencarian cepat khusus bagian /hentai.
 *
 * Halaman /hentai memakai rute ini untuk menampilkan hasil sambil mengetik,
 * jadi penonton tidak perlu menekan Enter atau menunggu navigasi penuh.
 * Cache di sini penting: batas laju API sumber 45 permintaan/menit.
 */

const MAX_ITEMS = 18;

export async function GET(request: Request) {
<<<<<<< HEAD
=======
  const limited = await rateLimitGuard(request, { name: 'nekopoi-search', limit: 30, windowSeconds: 60 });
  if (limited) return limited;

>>>>>>> c5dfbd0 (Update maintennace)
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().slice(0, 100);

  if (q.length < 2) {
    return NextResponse.json({ query: q, items: [], hasNext: false });
  }

  try {
    const { items, pagination } = await searchNekopoiCatalog(q, 1);
    const cards = items
      .filter(nekopoiIsHentaiItem)
      .map(nekopoiToCard)
      .slice(0, MAX_ITEMS);

    return NextResponse.json(
      { query: q, items: cards, hasNext: pagination.hasNextPage },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } }
    );
  } catch (error) {
<<<<<<< HEAD
    const message = error instanceof Error ? error.message : 'Pencarian gagal.';
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
=======
    return upstreamFailure('nekopoi-search', error, 'Pencarian sedang tidak tersedia. Coba lagi sebentar lagi.');
>>>>>>> c5dfbd0 (Update maintennace)
  }
}
