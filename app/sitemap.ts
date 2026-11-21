import type { MetadataRoute } from 'next';
import { getHome } from '@/lib/scraper';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/+$/, '');

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${siteUrl}/anime`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/ongoing`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/completed`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/schedule`, changeFrequency: 'daily', priority: 0.8 },
  ];

  try {
    const home = await getHome(1);
    const dynamicEntries: MetadataRoute.Sitemap = [];

    for (const item of home.featured) {
      if (item.slug) {
        dynamicEntries.push({
          url: `${siteUrl}/anime/${encodeURIComponent(item.slug)}`,
          changeFrequency: 'daily',
          priority: 0.8,
        });
      }
    }

    for (const item of home.completedLatest) {
      if (item.slug) {
        dynamicEntries.push({
          url: `${siteUrl}/anime/${encodeURIComponent(item.slug)}`,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }

    return [...staticRoutes, ...dynamicEntries];
  } catch {
    return staticRoutes;
  }
}
