const RESTRICTED_WORD_RE =
  /(?:^|[\s\-_/.,:;()[\]])(?:steamy|erotic[a]?|erotis|porn(?:o|ographic|ografi)?|adult|dewasa|xxx|nsfw|hentai|ecchi|jav|bokep|softcore|hardcore|nc-?17|18\+|21\+|semi[- ]?movie|gravure|uncensored|onlyfans)(?:$|[\s\-_/.,:;()[\]])/i;

const RESTRICTED_URL_RE =
  /\/(?:steamy|erotic[a]?|erotis|porn(?:o|ographic|ografi)?|adult|dewasa|xxx|nsfw|hentai|ecchi|jav|bokep|semi|18-plus|18\+|21\+|nc-17)(?:\/|$|[?#])/i;

const NON_MOVIE_URL_RE =
  /\/(?:series|tvshows?|tv-series|drama|episode|season|anime)(?:\/|$)/i;

const NON_MOVIE_SECTION_RE =
  /^(?:series|tv\s*series|tv\s*shows?|drama\s*series|anime|episode\s+terbaru)$/i;

export function isRestrictedText(text: string | null | undefined): boolean {
  if (!text) return false;
  return RESTRICTED_WORD_RE.test(text);
}

export function isRestrictedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return RESTRICTED_URL_RE.test(url) || RESTRICTED_WORD_RE.test(url);
}

export function isNonMovieUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return NON_MOVIE_URL_RE.test(url);
}

export function isNonMovieSectionHeading(heading: string | null | undefined): boolean {
  if (!heading) return false;
  return NON_MOVIE_SECTION_RE.test(heading.trim());
}

export interface FilterCandidate {
  title?: string | null;
  originalTitle?: string | null;
  url?: string | null;
  sourceUrl?: string | null;
  genres?: string[] | null;
  categories?: string[] | null;
  ratingLabel?: string | null;
  synopsis?: string | null;
}

export function isRestrictedMovie(candidate: FilterCandidate): boolean {
  if (isRestrictedUrl(candidate.url) || isRestrictedUrl(candidate.sourceUrl)) return true;
  if (isRestrictedText(candidate.title) || isRestrictedText(candidate.originalTitle)) return true;
  if (isRestrictedText(candidate.ratingLabel)) return true;

  for (const genre of candidate.genres ?? []) {
    if (isRestrictedText(genre)) return true;
  }
  for (const category of candidate.categories ?? []) {
    if (isRestrictedText(category)) return true;
  }
  if (candidate.synopsis && RESTRICTED_WORD_RE.test(candidate.synopsis)) return true;

  return false;
}
