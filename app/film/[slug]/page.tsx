import Link from 'next/link';
import { notFound } from 'next/navigation';
import { filmDetail, filmOrigin, validFilmSlug } from '@/lib/films';

export default async function FilmPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ player?: string }>;
}) {
  const { slug } = await params;
  if (!validFilmSlug.test(slug)) notFound();
  const film = await filmDetail(slug).catch(() => undefined);
  if (film === null) notFound();
  const { player } = await searchParams;
  const selected = film?.players.find(p => p.name === player) ?? film?.players[0];
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <Link href="/film" className="text-sm underline">Katalog film</Link>
      <h1 className="font-display text-3xl font-bold">{film?.title || slug.replaceAll('-', ' ')}</h1>
      {selected && <iframe title={'Pemutar ' + film?.title} src={selected.url} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full rounded bg-black" />}
      {film?.players.length ? <nav aria-label="Pilih pemutar" className="flex flex-wrap gap-4">
        {film.players.map(p => <Link key={p.url} aria-current={selected === p ? 'page' : undefined} className="underline aria-current:font-bold" href={'/film/' + slug + '?player=' + encodeURIComponent(p.name)}>{p.name}</Link>)}
      </nav> : <p>Pemutar belum tersedia.</p>}
      <div className="flex items-start gap-4">
        {film?.poster && <img src={film.poster} alt="" className="w-24 rounded" />}
        {film?.synopsis && <p className="whitespace-pre-line">{film.synopsis}</p>}
      </div>
      <div className="flex gap-5 text-sm underline">
        {selected && <a href={selected.url} target="_blank" rel="noopener noreferrer">Buka pemutar di tab baru</a>}
        <a href={filmOrigin + '/' + slug} target="_blank" rel="noopener noreferrer">Buka halaman sumber</a>
        {film?.download && <a href={film.download} target="_blank" rel="noopener noreferrer">Halaman download</a>}
        {!film?.download && <span className="text-muted no-underline">Download belum tersedia</span>}
      </div>
    </div>
  );
}
