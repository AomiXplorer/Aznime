import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Endpoint internal + halaman hasil pencarian (konten duplikat/bertumpuk
        // dengan katalog) tidak perlu diindeks. Aset CSS/JS/gambar tetap terbuka
        // karena Googlebot butuh merendernya.
        disallow: ['/api/', '/search'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
