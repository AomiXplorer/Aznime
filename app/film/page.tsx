import { FilmCatalog } from '@/components/FilmCatalog';

export const metadata = { title: 'Cari film' };

export default async function Films({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 120);
  return <div className="mx-auto max-w-7xl px-4 py-8"><FilmCatalog query={query} /></div>;
}
