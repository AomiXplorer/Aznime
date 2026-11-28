import type { FilmCard as FilmCardItem } from '@/lib/film';
import { FilmCard } from './FilmCard';

interface FilmGridProps {
  items: FilmCardItem[];
}

/** Grid katalog film; kolomnya mengikuti grid anime/komik. */
export function FilmGrid({ items }: FilmGridProps) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {items.map((item) => (
        <FilmCard key={item.id} item={item} />
      ))}
    </div>
  );
}
