import { Skeleton } from '@/components/Skeleton';

export default function MovieLoading() {
  return (
    <div role="status" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <span className="sr-only">Memuat film</span>
      <Skeleton className="mb-5 h-8 w-2/5" />
      <Skeleton className="aspect-video w-full" />
    </div>
  );
}
