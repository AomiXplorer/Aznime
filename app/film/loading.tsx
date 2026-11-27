import { AnimeGridSkeleton, Skeleton } from '@/components/Skeleton';

export default function FilmLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>

      <AnimeGridSkeleton count={18} />
    </div>
  );
}
