import { AnimeGrid } from './AnimeGrid';
import { AnimeRow } from './AnimeRow';
import { filmCardItem, filmCatalog } from '@/lib/films';

export async function FilmCatalog({ query = '', home = false }: { query?: string; home?: boolean }) {
  const { cards, offline } = await filmCatalog(query);
  const items = cards.map(filmCardItem);
  if (home) return <AnimeRow title="Film populer" items={items.slice(0, 14)} viewAllHref="/film" />;
  return (
    <section aria-label="Katalog film" className="space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <h2 className="font-display text-xl font-semibold">{query ? 'Hasil pencarian film' : 'Film populer'}</h2>
      </div>
      {offline && <p className="text-sm text-muted">Sumber sedang tidak tersedia. Pencarian dan daftar film sementara terbatas.</p>}
      <AnimeGrid items={items} />
      {!items.length && <p>Tidak ada film yang cocok dengan “{query}”.</p>}
    </section>
  );
}
