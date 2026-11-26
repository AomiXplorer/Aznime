import { load } from 'cheerio';

export const filmOrigin = 'https://tv13.lk21official.cc';
export const validFilmSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*-(?:19|20)\d{2}$/;

interface FilmCard { slug: string; title: string; poster: string }

// Snapshot of the source's monthly ranking for use during upstream outages.
const snapshot = [
  ['apocalypse-z-new-world-2026', 'Apocalypse Z: New World (2026)', '10/film-apocalypse-z-new-world-2026', 'qQI2gALkhubGs_Yg5H_b7g', 'Roberto menyimpan rahasia saat ikut mengantar bantuan ke Spanyol di tengah wabah.'],
  ['resident-evil-2026', 'Resident Evil (2026)', '11/film-resident-evil-2026-2', 'wEiLFXMvEUnPsnlQ_OcsRg', 'Satu malam mengubah tugas kurir medis Bryan menjadi perjuangan untuk bertahan hidup.'],
  ['odyssey-2026', 'The Odyssey (2026)', '11/film-odyssey-2026', 'KDvepiuC31eGbS6w9suyVg', 'Seusai Perang Troya, Odysseus menghadapi para Siren dan Cyclops dalam perjalanan pulang.'],
  ['spider-man-brand-new-day-2026', 'Spider-Man: Brand New Day (2026)', '10/film-spider-man-brand-new-day-2026', '10JeiG6WPgs0uv5ripdtKA', 'Peter Parker menghadapi perubahan dalam dirinya saat orang-orang terdekatnya kehilangan ingatan tentang dia.'],
  ['heart-beast-2026', 'Heart of the Beast (2026)', '11/film-heart-beast-2026', 'R9RqXl9g65NoO5ZHSjJgRA', 'Seorang mantan tentara dan anjingnya harus bertahan di belantara Alaska setelah pesawat mereka jatuh.'],
  ['your-mother-your-mother-your-mother-2026', 'Your Mother Your Mother Your Mother (2026)', '11/film-your-mother-your-mother-your-mother-2026', 'fOQDiJwB_J9WYRMT4McKXQ', 'Sepeninggal istrinya, Latif melintasi Houston demi membawa anak-anaknya ke tempat aman.'],
].map(([slug, title, file, playerId, synopsis]) => ({ slug, title, playerId, synopsis, poster: `https://poster.assetsy.de/wp-content/uploads/2026/${file}-lk21.jpg` }));

function allowedUrl(value: string | undefined, origin: string) {
  if (!value) return '';
  try {
    const url = new URL(value, filmOrigin);
    return url.origin === origin && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

async function readPage(path: string) {
  const response = await fetch(filmOrigin + path, {
    next: { revalidate: 600 }, signal: AbortSignal.timeout(5000), redirect: 'error',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Sumber film belum tersedia.');
  const $ = load(await response.text());
  if (!$('form[action="/search"]').length) throw new Error('Katalog film belum tersedia.');
  return $;
}

function parseCards($: ReturnType<typeof load>, selector: string) {
  const cards = new Map<string, FilmCard>();
  $(selector).each((_, image) => {
    const img = $(image);
    const href = allowedUrl(img.closest('a').attr('href'), filmOrigin);
    const slug = href && new URL(href).pathname.replace(/^\/|\/$/g, '');
    const title = img.attr('alt')?.trim();
    const poster = allowedUrl(img.attr('data-src') || img.attr('src'), 'https://poster.assetsy.de');
    if (!img.closest('a').text().match(/\bEPS\b/i) && validFilmSlug.test(slug) && title && poster && !cards.has(slug)) cards.set(slug, { slug, title, poster });
  });
  return cards;
}

export async function filmCatalog(query = '') {
  try {
    const $ = await readPage(query ? '/search?s=' + encodeURIComponent(query) : '/populer');
    if (!$) throw new Error('Halaman tidak tersedia');
    const cards = parseCards($, 'article a[href] img');
    if (!cards.size) throw new Error('Daftar kosong');
    return { cards: [...cards.values()], offline: false };
  } catch {
    try {
      const home = await readPage('/');
      if (home) {
        const selector = query ? 'a[href] img' : '[aria-label="TOP BULAN INI"] a[href] img';
        const recent = [...parseCards(home, selector).values()];
        if (recent.length) return {
          cards: recent.filter(f => f.title.toLowerCase().includes(query.toLowerCase())),
          offline: Boolean(query),
        };
      }
    } catch { /* Use the bundled monthly ranking if both pages are unavailable. */ }
    return { cards: snapshot.filter(f => f.title.toLowerCase().includes(query.toLowerCase())), offline: true };
  }
}

async function availableDownload(value: string) {
  if (!value) return '';
  try {
    const response = await fetch(value, {
      method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(2500),
      next: { revalidate: 600 },
    });
    return response.ok ? value : '';
  } catch {
    return '';
  }
}

export async function filmDetail(slug: string) {
  if (!validFilmSlug.test(slug)) return null;
  const stored = snapshot.find(f => f.slug === slug);
  const $ = await readPage('/' + slug).catch(error => {
    if (!stored) throw error;
    return undefined;
  });
  if ($ === undefined && stored) {
    return { ...stored, players: [{ name: 'P2P', url: 'https://videonode.de/iframe3/p2p/' + stored.playerId + '?v=1' }],
      download: await availableDownload('https://dadadidi.de/' + slug + '/') };
  }
  if (!$) return null;
  const players = $('#player-list a').toArray().map(a => ({
    name: $(a).text().trim(),
    url: allowedUrl($(a).attr('data-url') || $(a).attr('href'), 'https://videonode.de'),
  })).filter(player => player.url);
  const synopsis = $('.meta-info .synopsis').clone();
  synopsis.find('br').replaceWith('\n');
  return {
    title: $('h1').first().text().trim(), synopsis: synopsis.text().trim(),
    poster: allowedUrl($('meta[property="og:image"]').attr('content'), 'https://poster.assetsy.de'),
    players, download: await availableDownload(allowedUrl($('a[href]').filter((_, a) => $(a).text().trim().toLowerCase() === 'download').first().attr('href'), 'https://dadadidi.de')),
  };
}
