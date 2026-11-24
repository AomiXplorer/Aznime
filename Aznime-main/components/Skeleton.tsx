import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('shimmer rounded-md', className)} />;
}

export function AnimeCardSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="mt-2 space-y-1.5">
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function AnimeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Memuat daftar anime"
      className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <AnimeCardSkeleton key={idx} />
      ))}
    </div>
  );
}
