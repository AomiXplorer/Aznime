import { VideoPlayer } from '@/components/VideoPlayer';
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
      {film && selected ? (
        <VideoPlayer
          key={selected.url}
          title={film.title}
          servers={[selected, ...film.players.filter(p => p.url !== selected.url)].map(p => ({
            ...p, available: true, type: 'iframe',
          }))}
          defaultEmbed={selected.url}
          poster={film.poster}
          episodes={[]}
          navigation={{ prev: null, all: null, next: null }}
          seriesSlug={null}
          totalEpisodes={1}
          standalone
        />
      ) : <p>Pemutar belum tersedia.</p>}
      <div className="flex items-start gap-4">
        {film?.poster && <img src={film.poster} alt="" className="w-24 rounded" />}
        <p className="whitespace-pre-line">{film?.synopsis?.trim() || 'Sinopsis belum tersedia.'}</p>
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
