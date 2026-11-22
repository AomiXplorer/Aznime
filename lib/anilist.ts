import type { AniListTrailer } from './scraper/types';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

interface AniListGraphQLResponse {
  data?: {
    Media?: {
      id?: number;
      title?: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
      } | null;
      bannerImage?: string | null;
      coverImage?: {
        extraLarge?: string | null;
        large?: string | null;
      } | null;
      trailer?: {
        id?: string | null;
        site?: string | null;
        thumbnail?: string | null;
      } | null;
    } | null;
  };
}

const trailerCache = new Map<string, { value: AniListTrailer | null; expiresAt: number }>();

export function cleanAnimeTitleForMatch(rawTitle: string): string {
  return rawTitle
    .replace(/\bsubtitle\s+indonesia\b/gi, '')
    .replace(/\bsub\s+indo\b/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(\s*(tv|movie|special|dub|sub|bd|bluray|uncensored|ova|ona)\s*\)/gi, '')
    .replace(/\b(bd|bluray|uncensored)\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+episode\s+\d+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTitleCandidates(title: string, altTitle?: string | null): string[] {
  const candidates: string[] = [];
  const pushUnique = (val: string | null | undefined) => {
    if (!val) return;
    const cleaned = cleanAnimeTitleForMatch(val);
    if (cleaned.length >= 2 && !candidates.includes(cleaned)) {
      candidates.push(cleaned);
    }
  };

  pushUnique(title);
  if (altTitle) {
    for (const part of altTitle.split(/[,/|;]/)) {
      pushUnique(part);
    }
  }
  // Fallback without "Season X" suffix if needed
  const baseCleaned = cleanAnimeTitleForMatch(title);
  const withoutSeason = baseCleaned.replace(/\bseason\s+\d+\b/gi, '').replace(/\s+/g, ' ').trim();
  if (withoutSeason.length >= 2 && !candidates.includes(withoutSeason)) {
    candidates.push(withoutSeason);
  }

  // Fallback stripping "Movie:" / "-hen" (e.g., "Chainsaw Man Movie: Reze-hen" -> "Chainsaw Man Reze")
  const movieNormalized = baseCleaned
    .replace(/\bmovie\b\s*:?/gi, ' ')
    .replace(/-hen\b/gi, '')
    .replace(/[:–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (movieNormalized.length >= 2 && !candidates.includes(movieNormalized)) {
    candidates.push(movieNormalized);
  }

  return candidates;
}

const MEDIA_TRAILER_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    id
    title {
      romaji
      english
      native
    }
    bannerImage
    coverImage {
      extraLarge
      large
    }
    trailer {
      id
      site
      thumbnail
    }
  }
}
`;

async function queryAniListMedia(searchTerm: string): Promise<AniListTrailer | null> {
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: MEDIA_TRAILER_QUERY,
        variables: { search: searchTerm },
      }),
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 43200 },
    });

    if (!res.ok) return null;
    const json = (await res.json()) as AniListGraphQLResponse;
    const media = json.data?.Media;
    if (!media) return null;

    const coverImage = media.coverImage?.extraLarge || media.coverImage?.large || null;
    const bannerImage = media.bannerImage || null;
    const trailer = media.trailer;

    if (!trailer?.id || !trailer?.site) {
      if (!bannerImage && !coverImage) return null;
      return {
        id: '',
        site: '',
        thumbnail: null,
        bannerImage,
        coverImage,
        matchedTitle: media.title?.english || media.title?.romaji || null,
      };
    }

    const site = trailer.site.toLowerCase();
    const thumbnail =
      trailer.thumbnail ||
      (site === 'youtube' ? `https://i.ytimg.com/vi/${trailer.id}/hqdefault.jpg` : null);

    return {
      id: trailer.id,
      site,
      thumbnail,
      bannerImage,
      coverImage,
      matchedTitle: media.title?.english || media.title?.romaji || null,
    };
  } catch {
    return null;
  }
}

export async function getAniListTrailer(
  title: string,
  altTitle?: string | null
): Promise<AniListTrailer | null> {
  const candidates = buildTitleCandidates(title, altTitle);
  if (candidates.length === 0) return null;

  const cacheKey = candidates[0].toLowerCase();
  const cached = trailerCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  let bestFallback: AniListTrailer | null = null;

  for (const candidate of candidates.slice(0, 3)) {
    const result = await queryAniListMedia(candidate);
    if (result?.id && result.site === 'youtube') {
      trailerCache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      });
      return result;
    }
    if (result?.id && !bestFallback) {
      bestFallback = result;
    } else if ((result?.bannerImage || result?.coverImage) && !bestFallback) {
      bestFallback = result;
    }
  }

  trailerCache.set(cacheKey, {
    value: bestFallback,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  });
  return bestFallback;
}
