import type { ComicCard as ComicCardItem } from '@/lib/comics';
import { ComicCard } from './ComicCard';

interface ComicGridProps {
  items: ComicCardItem[];
  aspect?: '2/3' | '3/4';
  showSource?: boolean;
}

/** Grid katalog komik/webtoon; kolomnya mengikuti grid anime supaya konsisten. */
export function ComicGrid({ items, aspect = '2/3', showSource = false }: ComicGridProps) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {items.map((item) => (
        <ComicCard key={item.id} item={item} aspect={aspect} showSource={showSource} />
      ))}
    </div>
  );
}
