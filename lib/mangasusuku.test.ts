import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterLabel,
  cleanChapterSlug,
  manhwaChapterHref,
  manhwaHref,
  mangasusukuSlug,
  seriesSlugFromChapter,
} from './mangasusuku';

/* Slug hasil pencarian diturunkan dari judul karena respons /search tidak
   membawa slug. Aturannya harus sama dengan WordPress yang dipakai sumber:
   apostrof dibuang, bukan diubah jadi tanda hubung. Kalau aturan ini meleset,
   kartu hasil pencarian menautkan halaman 404. */
test('slug judul mengikuti aturan sumber', () => {
  assert.equal(mangasusukuSlug('Secret: No Disclosure'), 'secret-no-disclosure');
  assert.equal(mangasusukuSlug('Knot My Secret'), 'knot-my-secret');
  assert.equal(
    mangasusukuSlug('The Female Professor’s Secret Account'),
    'the-female-professors-secret-account'
  );
  assert.equal(mangasusukuSlug('A Gyaru’s Secret Sex-Ed Lesson!'), 'a-gyarus-secret-sex-ed-lesson');
  assert.equal(
    mangasusukuSlug('[GERAK] The Delinquent Girl Uncen'),
    'gerak-the-delinquent-girl-uncen'
  );
  assert.equal(mangasusukuSlug('Sweet Girl, Dirty Secrets'), 'sweet-girl-dirty-secrets');
});

/* Judul tanpa huruf Latin tidak bisa ditautkan; kartunya harus dilewati,
   bukan menghasilkan tautan kosong. */
test('judul non-Latin tidak menghasilkan slug', () => {
  assert.equal(mangasusukuSlug('비밀수업'), null);
  assert.equal(mangasusukuSlug('秘密教學'), null);
  assert.equal(mangasusukuSlug('   '), null);
});

test('slug chapter dibersihkan dari garis miring', () => {
  assert.equal(cleanChapterSlug('secret-class-chapter-324/'), 'secret-class-chapter-324');
  assert.equal(cleanChapterSlug('/get-out-chapter-19/'), 'get-out-chapter-19');
  assert.equal(cleanChapterSlug('  '), '');
});

test('slug seri diturunkan dari slug chapter', () => {
  assert.equal(seriesSlugFromChapter('secret-class-chapter-324'), 'secret-class');
  assert.equal(seriesSlugFromChapter('get-out-chapter-19/'), 'get-out');
  assert.equal(seriesSlugFromChapter('a-bachelor-in-the-country-chapter-46-end'), null);
  assert.equal(seriesSlugFromChapter('judul-tanpa-nomor'), null);
});

test('label chapter dirapikan ke bentuk pendek', () => {
  assert.equal(chapterLabel('Secret class chapter 324', 'secret-class-chapter-324'), 'Chapter 324');
  assert.equal(chapterLabel('Chapter 12.5', 'x-chapter-12.5'), 'Chapter 12.5');
  assert.equal(chapterLabel(null, 'get-out-chapter-19'), 'Chapter 19');
  assert.equal(chapterLabel(null, 'judul-aneh'), 'judul-aneh');
});

test('tautan internal memakai slug yang di-encode', () => {
  assert.equal(manhwaHref('secret-class'), '/manhwa18/secret-class');
  assert.equal(
    manhwaChapterHref('secret-class', 'secret-class-chapter-324/'),
    '/manhwa18/secret-class/secret-class-chapter-324'
  );
});
