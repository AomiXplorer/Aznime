import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aznime – Streaming Anime Subtitle Indonesia',
    short_name: 'Aznime',
    description:
      'Stream anime with Indonesian subtitles, a fast catalog, daily airing schedules, and a player that picks the fastest server.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0b0e',
    theme_color: '#0a0b0e',
    lang: 'id-ID',
    categories: ['entertainment', 'video'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
