import { NextResponse } from 'next/server';
import { getFilterOptions } from '@/lib/scraper';

export async function GET() {
  try {
    const options = await getFilterOptions();
    return NextResponse.json(options, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat opsi filter';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
