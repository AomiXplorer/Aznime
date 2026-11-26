import Link from 'next/link';
import { filmCatalog } from '@/lib/films';

export async function FilmCatalog({ query = '', home = false }: { query?: string; home?: boolean }) {
  const { cards, offline } = await filmCatalog(query);
  return (
    <section aria-label="Katalog film" className="space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h2 className="font-display text-xl font-semibold">{query ? 'Hasil pencarian film' : 'Film populer'}</h2>
        {home && <Link href="/film" className="text-sm underline">Semua film</Link>}
      </div>
      <form action="/film" className="flex max-w-xl gap-2">
        <input type="search" name="q" defaultValue={query} maxLength={120} aria-label="Judul film" placeholder="Cari judul film" className="min-w-0 flex-1 rounded border border-line bg-transparent px-3 py-2" />
        <button className="rounded bg-white px-4 text-sm font-semibold text-black">Cari film</button>
      </form>
      {offline && <p className="text-sm text-muted">Sumber sedang tidak tersedia. Pencarian dan daftar film sementara terbatas.</p>}
      {cards.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {(home ? cards.slice(0, 6) : cards).map(film => (
          <Link key={film.slug} href={'/film/' + film.slug} prefetch={false} className="space-y-2 hover:underline">
            <img src={film.poster} loading="lazy" alt="" className="aspect-[2/3] w-full rounded object-cover" />
            <span className="text-sm font-semibold">{film.title}</span>
          </Link>
        ))}
      </div> : <p>Tidak ada film yang cocok dengan “{query}”.</p>}
    </section>
  );
}
