import { NextResponse } from 'next/server';
import { FILM_BASE } from '@/lib/film';
import { createPanelBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

const TARGETS = [
  'https://komiku.org/',
  'https://api.komiku.org/?s=naruto&post_type=manga',
  'https://img.komiku.org/',
  'https://komikindo.me/',
  'https://kiryuu.co/',
  'https://m.webtoons.com/id/',
  /* Sumber film (Juraganfilm): beranda katalog dan satu pencarian. Keduanya
     harus menjawab 200 dari server produksi; kalau tidak, /film akan kosong. */
  `${FILM_BASE}/`,
  `${FILM_BASE}/?s=doraemon`,
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Kesiapan backup panel, hanya untuk pemegang TELEGRAM_WEBHOOK_SECRET.
 * Membentuk arsipnya tanpa mengirim ke mana pun, jadi bisa dipakai memastikan
 * folder panel benar-benar terbaca dari dalam container.
 */
async function backupProbe(req: Request): Promise<Record<string, unknown> | null> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
  const provided = req.headers.get('x-telegram-bot-api-secret-token')?.trim() || '';
  if (!secret || provided !== secret) return null;

  try {
    const file = await createPanelBackup();
    return { ok: true, filename: file.filename, bytes: file.data.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'gagal' };
  }
}

export async function GET(req: Request) {
  const results = await Promise.all(
    TARGETS.map(async (url) => {
      const started = Date.now();
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*', Referer: url },
          signal: AbortSignal.timeout(12000),
          cache: 'no-store',
        });
        const body = await res.text();
        return {
          url,
          status: res.status,
          ms: Date.now() - started,
          bytes: body.length,
          title: /<title>([^<]{0,70})/.exec(body)?.[1] ?? null,
        };
      } catch (error) {
        return {
          url,
          status: 0,
          ms: Date.now() - started,
          error: error instanceof Error ? error.message : 'gagal',
        };
      }
    })
  );

  const wantsBackup = new URL(req.url).searchParams.get('backup') === '1';
  const backup = wantsBackup ? await backupProbe(req) : undefined;

  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    results,
    ...(wantsBackup ? { backup: backup ?? { ok: false, error: 'tidak diizinkan' } } : {}),
  });
}
