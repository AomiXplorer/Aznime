import { AnimeGridSkeleton, Skeleton } from '@/components/Skeleton';

/**
 * Kerangka katalog.
 *
 * /anime dirender dinamis: satu kunjungan berarti beberapa permintaan ke server
 * sumber. Tanpa berkas ini, menekan "Katalog" dari menu membuat layar diam
 * sampai HTML selesai dibuat, dan di jaringan seluler itu terasa seperti macet.
 * Kerangkanya meniru tata letak akhir (judul, baris filter, grid poster) supaya
 * tidak ada lompatan tata letak saat data asli masuk.
 */
export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>

      <div className="mb-7 flex flex-wrap gap-2" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={idx} className="h-9 w-24 rounded-[4px]" />
        ))}
      </div>

      <AnimeGridSkeleton count={18} />
    </div>
  );
}
