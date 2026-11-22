import type { MetadataRoute } from 'next';
import { getAnimeList, getHome, getOngoing } from '@/lib/scraper';
import { SITE_URL } from '@/lib/site';

/** Sitemap di-cache dan diregenerasi tiap jam agar mengikuti konten dinamis. */
export const revalidate = 3600;

/** Batas aman ukuran sitemap (protokol: maks 50.000 URL / 50 MB). */
const MAX_URLS = 500;
/** Berapa halaman katalog yang ikut dipanen untuk URL detail. */
const CATALOG_PAGES = 4;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/anime`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/ongoing`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/completed`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/schedule`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/credit`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const seen = new Set<string>();
  const detailRoutes: MetadataRoute.Sitemap = [];

  const addSlug = (slug: string | null | undefined, priority: number) => {
    if (!slug) return;
    const url = `${SITE_URL}/anime/${encodeURIComponent(slug)}`;
    if (seen.has(url)) return;
    seen.add(url);
    detailRoutes.push({
      url,
      lastModified: now,
      changeFrequency: 'daily',
      priority,
    });
  };

  // Beranda: anime unggulan + rilis terbaru + baru tamat.
  try {
    const home = await getHome(1);
    for (const item of home.featured) addSlug(item.slug, 0.8);
    for (const item of home.latestRelease) addSlug(item.slug, 0.7);
    for (const item of home.completedLatest) addSlug(item.slug, 0.7);
  } catch {
    /* diabaikan: sitemap tetap valid walau upstream sedang down */
  }

  // Ongoing.
  try {
    const ongoing = await getOngoing(1);
    for (const item of ongoing.results) addSlug(item.slug, 0.7);
  } catch {
    /* diabaikan */
  }

  // Katalog berhalaman (urutan update = konten terbaru).
  for (let page = 1; page <= CATALOG_PAGES; page += 1) {
    try {
      const list = await getAnimeList({ page, order: 'update' });
      for (const item of list.results) addSlug(item.slug, 0.6);
      if (!list.pagination.hasNextPage) break;
    } catch {
      break;
    }
  }

  const remaining = Math.max(0, MAX_URLS - staticRoutes.length);
  return [...staticRoutes, ...detailRoutes.slice(0, remaining)];
}
