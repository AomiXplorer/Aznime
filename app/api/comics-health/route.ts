import { NextResponse } from 'next/server';

/**
 * Diagnosa sumber komik/webtoon dari sisi server produksi.
 *
 * Alamat IP server (Vercel) berbeda dari IP rumah pengembang, jadi situs sumber
 * bisa menjawab normal di laptop tetapi menolak di produksi. Route ini hanya
 * melaporkan kode status dan waktu tiap panggilan supaya penyebabnya jelas,
 * tanpa membocorkan isi halaman maupun kredensial.
 */

export const dynamic = 'force-dynamic';

const UA_MOBILE =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface Probe {
  name: string;
  url: string;
  headers?: Record<string, string>;
  ua: string;
}

async function probe({ name, url, headers, ua }: Probe) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': ua, Accept: '*/*', ...(headers || {}) },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    const body = await response.text();
    return {
      name,
      status: response.status,
      ms: Date.now() - started,
      bytes: body.length,
      // Penanda isi yang aman: apakah halaman/JSON yang diharapkan muncul.
      hasTitleState: body.includes('__titleHomeState__'),
      hasImageList: body.includes('var imageList'),
      hasCards: body.includes('data-title-no='),
      looksBlocked: /just a moment|attention required|cf-browser-verification/i.test(body.slice(0, 4000)),
      snippet: body.slice(0, 120).replace(/\s+/g, ' '),
    };
  } catch (error) {
    return {
      name,
      status: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : 'gagal',
    };
  } finally {
    clearTimeout(timer);
  }
}

import { getWebtoonDetail, getWebtoonEpisode } from '@/lib/comics';

export async function GET() {
  const probes: Probe[] = [
    {
      name: 'webtoon:home-id',
      url: 'https://m.webtoons.com/id/',
      ua: UA_MOBILE,
    },
    {
      name: 'webtoon:search',
      url: 'https://m.webtoons.com/id/search/result?keyword=eleceed&searchType=ALL&start=1',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://m.webtoons.com/id' },
      ua: UA_MOBILE,
    },
    {
      name: 'webtoon:title-list',
      url: 'https://m.webtoons.com/id/action/eleceed/list?title_no=1571',
      ua: UA_MOBILE,
    },
    {
      name: 'webtoon:episodes-api',
      url: 'https://m.webtoons.com/api/v1/webtoon/1571/episodes?pageSize=5&cursor=0&readingLanguageCode=en',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://m.webtoons.com/en' },
      ua: UA_MOBILE,
    },
    {
      name: 'webtoon:viewer',
      url: 'https://m.webtoons.com/en/action/eleceed/episode-1/viewer?title_no=1571&episode_no=1',
      ua: UA_MOBILE,
    },
    {
      name: 'webtoon:episodes-2034-id',
      url: 'https://m.webtoons.com/api/v1/webtoon/2034/episodes?pageSize=60&cursor=0&readingLanguageCode=id',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://m.webtoons.com/id' },
      ua: UA_MOBILE,
    },
    {
      name: 'webtoon:episodes-2034-id-30',
      url: 'https://m.webtoons.com/api/v1/webtoon/2034/episodes?pageSize=30&cursor=0&readingLanguageCode=id',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://m.webtoons.com/id' },
      ua: UA_MOBILE,
    },
    {
      name: 'webtoon:title-2034-tanpa-genre',
      url: 'https://m.webtoons.com/id/eleceed/list?title_no=2034',
      ua: UA_MOBILE,
    },
    {
      name: 'komiku:home',
      url: 'https://komiku.org/',
      ua: UA_DESKTOP,
    },
    {
      name: 'komiku:search',
      url: 'https://api.komiku.org/?s=eleceed&post_type=manga',
      headers: { Referer: 'https://komiku.org/' },
      ua: UA_DESKTOP,
    },
  ];

  const results = await Promise.all(probes.map((item) => probe(item)));
  return NextResponse.json({ checkedAt: new Date().toISOString(), results });
}
