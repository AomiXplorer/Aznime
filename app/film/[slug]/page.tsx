import Link from 'next/link';
import { notFound } from 'next/navigation';
import { filmDetail, filmOrigin, validFilmSlug } from '@/lib/films';

export default async function FilmPage({ params }: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!validFilmSlug.test(slug)) notFound();
  const film = await filmDetail(slug).catch(() => undefined);
  if (film === null) notFound();
  const sourceUrl = filmOrigin + '/' + slug;
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <Link href="/film" className="text-sm underline">Katalog film</Link>
      <h1 className="font-display text-3xl font-bold">{film?.title || slug.replaceAll('-', ' ')}</h1>
      <div className="rounded-lg border border-line bg-surface p-4">
        <p className="mb-3 text-sm text-zinc-300">
          Pemutar film ini dibuka di situs sumber.
        </p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
        >
          Tonton di situs sumber
        </a>
      </div>
      <div className="flex items-start gap-4">
        {film?.poster && <img src={film.poster} alt="" className="w-24 rounded" />}
        <p className="whitespace-pre-line">{film?.synopsis?.trim() || 'Sinopsis belum tersedia.'}</p>
      </div>
      <div className="flex gap-5 text-sm underline">
        {film?.download && <a href={film.download} target="_blank" rel="noopener noreferrer">Halaman download</a>}
        {!film?.download && <span className="text-muted no-underline">Download belum tersedia</span>}
      </div>
    </div>
  );
}
