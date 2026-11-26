import { Skeleton } from '@/components/Skeleton';

export function ComicDetailLoading() {
  return (
    <div role="status" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <span className="sr-only">Memuat sinopsis</span>
      <Skeleton className="mb-6 h-4 w-28" />
      <div className="grid gap-6 md:grid-cols-[220px_1fr] lg:grid-cols-[248px_1fr] lg:gap-9">
        <Skeleton className="mx-auto aspect-[3/4] w-[168px] sm:w-[196px] md:w-full" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full max-w-lg" />
        </div>
      </div>
    </div>
  );
}

export function ComicReaderLoading() {
  return (
    <div role="status" className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <span className="sr-only">Memuat halaman bacaan</span>
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton className="mb-4 h-6 w-48" />
      <Skeleton className="min-h-[55vh] w-full" />
    </div>
  );
}
