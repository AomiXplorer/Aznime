import komiku from '@/lib/scrapers/komiku.js';
import webtoons from '@/lib/scrapers/webtoons.js';

/**
 * Jembatan antara dua scraper (komiku.org dan m.webtoons.com) dan halaman situs.
 *
 * Keduanya sumber luar yang bisa lambat atau menolak permintaan, jadi setiap
 * fungsi di sini tidak pernah melempar: kegagalan dikembalikan sebagai
 * `offline: true` agar halaman tetap tampil dengan keadaan kosong yang jujur.
 */

export type ComicSource = 'komiku' | 'webtoon';

export interface ComicCard {
  id: string;
  source: ComicSource;
  title: string;
  poster: string | null;
  /** Genre atau tipe seadanya dari sumber, mis. "Fantasi" atau "Manhwa". */
  meta: string | null;
  /** Chapter/episode terbaru bila sumber menyebutkannya. */
  latest: string | null;
  href: string;
}

export interface ComicFeed {
  items: ComicCard[];
  offline: boolean;
}

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, { at: number; value: unknown }>();

/**
 * Cache pendek di memori instance: sumber luar tidak dipanggil tiap kunjungan.
 *
 * Panggilan yang sedang berjalan ikut dibagikan. Tanpa itu, generateMetadata
 * dan render halaman meminta judul yang sama dua kali bersamaan, lalu ditambah
 * dua permintaan episode; empat permintaan serentak ke WEBTOON membuat
 * daftar episode dijawab kosong.
 */
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, load: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const task = load()
    .then((value) => {
      if (store.size > 80) store.clear();
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
}

/**
 * Batas waktu keras untuk satu panggilan sumber luar. Scraper memakai 25 detik
 * per permintaan, terlalu lama untuk ditunggu halaman. 15 detik dipilih dari
 * pengukuran: permintaan pertama dari lambda dingin ke WEBTOON bisa 9-12 detik
 * (DNS + TLS + halaman 300 KB), sedangkan panggilan hangat 1-4 detik.
 */
function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function trim(value: string | null | undefined): string | null {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text || null;
}

/* ------------------------------------------------------------------ komik */

export function komikHref(slug: string): string {
  return `/komik/${encodeURIComponent(slug)}`;
}

/**
 * komiku.org menulis judul lengkap untuk mesin pencari: "Baca Manga One Piece
 * Bahasa Indonesia". Awalan dan akhiran itu dibuang supaya kartu hanya memuat
 * nama judulnya.
 */
function komikTitle(value: string | null | undefined): string | null {
  const text = trim(value);
  if (!text) return null;
  const cleaned = text
    .replace(/^Baca\s+(?:Komik|Manga|Manhwa|Manhua|Webtoon)\s+/i, '')
    /* Judul chapter ditulis "Baca <seri> <chapter> Bahasa Indonesia". */
    .replace(/^Baca\s+/i, '')
    .replace(/\s+Bahasa\s+Indonesia$/i, '')
    .trim();
  return cleaned || text;
}

/**
 * Sampul sumber membawa `?resize=240,280`. Parameter itu dibuang karena
 * /api/img yang menentukan ukuran akhir sesuai lebar kartu; kalau diteruskan,
 * gambar datang sudah dipotong dan tidak bisa diperbesar lagi.
 */
function komikPoster(value: string | null | undefined): string | null {
  const url = trim(value);
  if (!url) return null;
  return url.split('?')[0] || null;
}

/** "Fantasi · 32,715 views" -> "Fantasi". */
function komikMeta(value: string | null | undefined): string | null {
  const text = trim(value);
  if (!text) return null;
  return trim(text.split('·')[0]);
}

function komikCard(item: {
  title?: string | null;
  slug?: string | null;
  poster?: string | null;
  genre?: string | null;
  type?: string | null;
  latest?: { label?: string | null; chapter?: string | null } | string | null;
  latestLabel?: string | null;
  meta?: string | null;
}): ComicCard | null {
  const title = komikTitle(item.title);
  const slug = trim(item.slug);
  if (!title || !slug) return null;
  const latestRaw = typeof item.latest === 'string' ? item.latest : item.latest?.label || item.latest?.chapter;
  const latest = trim(item.latestLabel) || trim(latestRaw);
  return {
    id: `komiku:${slug}`,
    source: 'komiku',
    title,
    poster: komikPoster(item.poster),
    meta: komikMeta(item.genre) || komikMeta(item.meta) || trim(item.type),
    latest,
    href: komikHref(slug),
  };
}

function komikItems(cards: Parameters<typeof komikCard>[0][]): ComicCard[] {
  return cards.map(komikCard).filter((item): item is ComicCard => item !== null);
}

/**
 * Baris komik di beranda memakai /p/ranking/: sampulnya potret, dan setiap
 * kartu membawa genre serta jumlah views. Kalau halaman peringkat berubah
 * bentuk, beranda sumber dipakai sebagai cadangan.
 */
export function getKomikFeed(limit = 16): Promise<ComicFeed> {
  return cached(`komik:home:${limit}`, async () => {
    try {
      const items = komikItems(await withTimeout(komiku.getRanking()));
      if (items.length > 0) return { items: items.slice(0, limit), offline: false };
    } catch {
      /* lanjut ke cadangan */
    }
    try {
      const items = komikItems(await withTimeout(komiku.getHome()));
      return { items: items.slice(0, limit), offline: items.length === 0 };
    } catch {
      return { items: [], offline: true };
    }
  });
}

export function getKomikCatalog(query = '', limit = 40): Promise<ComicFeed> {
  const q = query.trim();
  return cached(`komik:list:${q}:${limit}`, async () => {
    try {
      const cards = q
        ? await withTimeout(komiku.search(q))
        : await withTimeout(komiku.getRanking());
      /* Sumber menjawab dengan baik tetapi tidak punya judul yang cocok.
         Itu bukan gangguan, jadi halaman harus bilang "tidak ditemukan". */
      return { items: komikItems(cards).slice(0, limit), offline: false };
    } catch {
      return { items: [], offline: true };
    }
  });
}

export interface KomikDetail {
  slug: string;
  title: string;
  altTitle: string | null;
  poster: string | null;
  synopsis: string | null;
  type: string | null;
  status: string | null;
  author: string | null;
  rating: string | null;
  genres: string[];
  chapters: { slug: string; label: string; title: string; date: string }[];
}

export async function getKomikDetail(slug: string): Promise<KomikDetail | null> {
  try {
    return await cached(`komik:detail:${slug}`, async () => {
      const manga = await withTimeout(komiku.getManga(slug));
      return {
        slug: manga.slug || slug,
        title: trim(manga.title) || slug.replaceAll('-', ' '),
        altTitle: trim(manga.altTitle),
        poster: komikPoster(manga.poster),
        synopsis: trim(manga.synopsis),
        type: trim(manga.type),
        status: trim(manga.status),
        author: trim(manga.author),
        rating: trim(manga.rating),
        genres: manga.genres || [],
        chapters: (manga.chapters || [])
          .filter((chapter) => chapter.slug)
          .map((chapter) => ({
            slug: chapter.slug as string,
            label: trim(chapter.label) || komikTitle(chapter.title) || (chapter.slug as string),
            title: komikTitle(chapter.title) || '',
            date: trim(chapter.date) || '',
          })),
      };
    });
  } catch {
    return null;
  }
}

export interface KomikChapterView {
  seriesSlug: string | null;
  seriesTitle: string | null;
  label: string;
  images: string[];
  prev: string | null;
  next: string | null;
}

export async function getKomikChapter(
  seriesSlug: string,
  chapterSlug: string
): Promise<KomikChapterView | null> {
  try {
    const chapter = await cached(`komik:chapter:${chapterSlug}`, () => withTimeout(komiku.getChapter(chapterSlug)));
    if (!chapter.images?.length) return null;
    return {
      seriesSlug: chapter.seriesSlug || seriesSlug,
      seriesTitle: trim(chapter.series),
      label:
        trim(chapter.chapter) ||
        trim(String(chapter.chapterNumber?.number ?? '')) ||
        chapterSlug,
      images: chapter.images.map((image) => image.url),
      prev: chapter.prev,
      next: chapter.next,
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- webtoon */

export function webtoonHref(titleNo: number, slug: string): string {
  return `/webtoon/${titleNo}-${encodeURIComponent(slug)}`;
}

/** "2034-eleceed" -> { titleNo: 2034, slug: "eleceed" } */
export function parseWebtoonSlug(value: string): { titleNo: number; slug: string } | null {
  const match = /^(\d{1,9})-(.+)$/.exec(value);
  if (!match) return null;
  const titleNo = Number(match[1]);
  if (!Number.isFinite(titleNo) || titleNo <= 0) return null;
  return { titleNo, slug: match[2] };
}

/** Satu bentuk kartu untuk semua jalur webtoon: beranda, trending, pencarian. */
function webtoonCard(input: {
  titleNo: number | null | undefined;
  title: string | null | undefined;
  poster: string | null | undefined;
  meta: string | null | undefined;
  slug: string | null | undefined;
}): ComicCard | null {
  const title = trim(input.title);
  const titleNo = input.titleNo;
  if (!title || !titleNo) return null;
  return {
    id: `webtoon:${titleNo}`,
    source: 'webtoon',
    title,
    poster: trim(input.poster),
    meta: trim(input.meta),
    latest: null,
    href: webtoonHref(titleNo, trim(input.slug) || webtoons.slugify(title)),
  };
}

/**
 * Beranda WEBTOON menampilkan judul yang sama di beberapa bagian (ranking,
 * baru, populer), jadi 104 kartu bisa berisi 66 judul. Duplikat dibuang sekali
 * di sini supaya grid tidak mengulang judul dan tidak meminta sampul yang sama
 * berkali-kali.
 */
function uniqueWebtoonCards(cards: (ComicCard | null)[]): ComicCard[] {
  const seen = new Set<string>();
  const items: ComicCard[] = [];
  for (const card of cards) {
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    items.push(card);
  }
  return items;
}

export function getWebtoonFeed(limit = 16): Promise<ComicFeed> {
  return cached(`webtoon:home:${limit}`, async () => {
    try {
      const cards = await withTimeout(webtoons.getHome({ lang: 'id' }));
      const items = uniqueWebtoonCards(
        cards.map((card) =>
          webtoonCard({
            titleNo: card.titleNo,
            title: card.title,
            poster: card.poster,
            meta: card.genre,
            slug: card.slug,
          })
        )
      ).slice(0, limit);
      return { items, offline: items.length === 0 };
    } catch {
      return { items: [], offline: true };
    }
  });
}

export function getWebtoonCatalog(query = '', limit = 40): Promise<ComicFeed> {
  const q = query.trim();
  return cached(`webtoon:list:${q}:${limit}`, async () => {
    try {
      let items: ComicCard[] = [];
      if (q) {
        const result = await withTimeout(webtoons.search(q, { lang: 'id' }));
        items = uniqueWebtoonCards(
          result.results.map((item) =>
            webtoonCard({
              titleNo: item.titleNo,
              title: item.title,
              poster: item.thumbnail,
              meta: item.genre || item.author,
              slug: item.slug,
            })
          )
        );
      } else {
        /* Beranda WEBTOON memberi sampul vertikal asli, sedangkan trending
           hanya 9 kartu persegi. Beranda dipakai lebih dulu, trending jadi
           cadangan kalau beranda berubah bentuk. */
        try {
          const home = await withTimeout(webtoons.getHome({ lang: 'id' }));
          items = uniqueWebtoonCards(
            home.map((card) =>
              webtoonCard({
                titleNo: card.titleNo,
                title: card.title,
                poster: card.poster,
                meta: card.genre,
                slug: card.slug,
              })
            )
          );
        } catch {
          /* lanjut ke cadangan */
        }
        if (items.length === 0) {
          const trending = await withTimeout(webtoons.trending({ lang: 'id' }));
          items = uniqueWebtoonCards(
            trending.map((item) =>
              webtoonCard({
                titleNo: item.titleNo,
                title: item.title,
                poster: item.thumbnail,
                meta: item.genre,
                slug: item.slug,
              })
            )
          );
        }
      }
      /* Pencarian yang tidak menemukan apa pun tetap jawaban sumber yang
         sehat, jadi bukan "sedang tidak bisa dihubungi". */
      return { items: items.slice(0, limit), offline: false };
    } catch {
      return { items: [], offline: true };
    }
  });
}

export interface WebtoonDetail {
  titleNo: number;
  slug: string;
  title: string;
  synopsis: string | null;
  poster: string | null;
  author: string | null;
  genre: string | null;
  status: string | null;
  rating: string | null;
  mature: boolean;
  tags: string[];
  episodes: { episodeNo: number; title: string; thumb: string | null; date: string | null }[];
}

export async function getWebtoonDetail(
  titleNo: number,
  slug: string
): Promise<WebtoonDetail | null> {
  try {
    const detail = await cached(`webtoon:detail:${titleNo}`, async () => {
      /* Segmen genre wajib ada di jalur. Tanpa itu WEBTOON menjawab 404 dari
         sebagian alamat IP, jadi 'action' dipakai sebagai pintu masuk dan
         situs mengalihkan sendiri ke genre yang benar. */
      const listUrl = `https://m.webtoons.com/id/action/${slug}/list?title_no=${titleNo}`;
      const [title, episodes] = await Promise.all([
        withTimeout(webtoons.getTitle(listUrl, { lang: 'id', titleNo })),
        withTimeout(webtoons.getEpisodes(titleNo, { lang: 'id', pageSize: 60 }), 12000)
          .catch(() => withTimeout(webtoons.getEpisodes(titleNo, { lang: 'id', pageSize: 30 }), 12000))
          .catch(() => []),
      ]);
      return {
        titleNo,
        slug: trim(title.slug) || slug,
        title: trim(title.title) || slug.replaceAll('-', ' '),
        synopsis: trim(title.synopsis),
        poster: trim(title.thumbnailVertical) || trim(title.thumbnail),
        author: trim(title.author),
        genre: trim(title.genre),
        status: trim(title.status),
        rating: trim(title.rating),
        mature: Boolean(title.mature),
        tags: title.tags || [],
        episodes: episodes.map((episode) => ({
          episodeNo: episode.episodeNo,
          title: trim(episode.title) || `Episode ${episode.episodeNo}`,
          thumb: trim(episode.thumb),
          date: episode.date,
        })),
      };
    });
    /* Hasil tanpa episode biasanya berarti panggilan episode gagal sesaat.
       Simpan sebentar saja supaya percobaan berikutnya masih bisa berhasil. */
    if (detail.episodes.length === 0) {
      store.set(`webtoon:detail:${titleNo}`, { at: Date.now() - TTL_MS + 60_000, value: detail });
    }
    return detail;
  } catch {
    return null;
  }
}

export interface WebtoonEpisodeView {
  titleNo: number;
  episodeNo: number;
  title: string | null;
  images: { url: string; width: number | null; height: number | null }[];
  prev: number | null;
  next: number | null;
}

/** Ambil nomor episode dari tautan viewer webtoons (…/episode-12/viewer?…). */
function episodeNumberFromUrl(value: string | null): number | null {
  if (!value) return null;
  const direct = /episode_no=(\d+)/.exec(value);
  if (direct) return Number(direct[1]);
  const path = /episode-(\d+)/i.exec(value);
  return path ? Number(path[1]) : null;
}

export async function getWebtoonEpisode(
  titleNo: number,
  slug: string,
  episodeNo: number
): Promise<WebtoonEpisodeView | null> {
  try {
    const detail = await getWebtoonDetail(titleNo, slug);
    const episode = detail?.episodes.find((item) => item.episodeNo === episodeNo);
    /* Genre dipakai untuk menyusun URL viewer; kalau gagal, 'action' tetap
       diarahkan ulang oleh WEBTOON ke genre yang benar. */
    const genre = await withTimeout(
      webtoons.getTitle(`https://m.webtoons.com/id/action/${slug}/list?title_no=${titleNo}`, {
        lang: 'id',
        titleNo,
      })
    )
      .then((title) => title.genreSlug)
      .catch(() => null);
    const viewerUrl =
      `https://m.webtoons.com/id/${genre || 'action'}/${slug}/episode-${episodeNo}/viewer` +
      `?title_no=${titleNo}&episode_no=${episodeNo}`;
    const viewer = await cached(`webtoon:viewer:${titleNo}:${episodeNo}`, () =>
      withTimeout(
        webtoons.getViewer(viewerUrl, {
          lang: 'id',
          titleNo,
          episodeNo,
          genre: genre || undefined,
          slug,
        })
      )
    );
    const images = (viewer.images || [])
      .map((image) => ({ url: image.url, width: image.width, height: image.height }))
      .filter((image) => Boolean(image.url));
    if (!images.length) return null;
    return {
      titleNo,
      episodeNo,
      title: trim(episode?.title) || trim(viewer.title),
      images,
      prev: episodeNumberFromUrl(viewer.prev),
      next: episodeNumberFromUrl(viewer.next),
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- pencarian */

export interface ComicSearchResult {
  komik: ComicCard[];
  webtoon: ComicCard[];
}

/**
 * Pencarian gabungan: satu kotak mencari anime, komik, dan webtoon sekaligus.
 * Hasil tiap sumber dipisah supaya pengguna tahu jenis karya yang muncul.
 */
export async function searchComics(query: string, limit = 8): Promise<ComicSearchResult> {
  const q = query.trim();
  if (!q) return { komik: [], webtoon: [] };
  const [komik, webtoon] = await Promise.all([
    getKomikCatalog(q, limit).then((feed) => feed.items).catch(() => []),
    getWebtoonCatalog(q, limit).then((feed) => feed.items).catch(() => []),
  ]);
  return { komik, webtoon };
}
