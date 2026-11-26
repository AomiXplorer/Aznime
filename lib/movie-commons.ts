import type { MovieDetail } from './movies';

export const COMMONS_MOVIES = [
  commonsFilm('the-general', 'The General', '1926', 'e/ee', 'The_General_(1926).webm', '480p', 'Seorang masinis mengejar lokomotifnya yang dicuri saat Perang Saudara Amerika.'),
  commonsFilm('sherlock-jr', 'Sherlock Jr.', '1924', '9/95', 'Sherlock_Jr._(1924).webm', '480p', 'Seorang operator proyektor bermimpi menjadi detektif dan masuk ke dalam film yang sedang ia putar.'),
  commonsFilm('nosferatu', 'Nosferatu', '1922', '9/9c', 'Nosferatu_le_vampire-Film_Murnau_1922.webm', '240p', 'Seorang agen properti datang ke kastel Count Orlok dan menemukan rahasia sang tuan rumah.'),
];

function commonsFilm(
  slug: string,
  title: string,
  year: string,
  hash: string,
  filename: string,
  quality: string,
  synopsis: string
): MovieDetail {
  const file = encodeURIComponent(filename);
  const href = '/movie/commons/' + slug;
  return {
    id: href, href, source: 'movie', title, synopsis, meta: year, latest: null,
    poster: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/' + hash + '/' + file + '/330px-' + file + '.jpg',
    video: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/' + hash + '/' + file + '/' + file + '.' + quality + '.vp9.webm',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:' + file,
    embed: null,
  };
}
