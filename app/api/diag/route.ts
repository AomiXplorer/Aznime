import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TARGETS = [
  'https://komiku.org/',
  'https://api.komiku.org/?s=naruto&post_type=manga',
  'https://img.komiku.org/',
  'https://komikindo.me/',
  'https://kiryuu.co/',
  'https://m.webtoons.com/id/',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function GET() {
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

  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, results });
}
