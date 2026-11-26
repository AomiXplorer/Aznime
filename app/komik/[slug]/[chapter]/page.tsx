import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { getKomikChapter, getKomikDetail } from '@/lib/comics';

interface KomikChapterProps {
  params: Promise<{ slug: string; chapter: string }>;
}

/** "/one-piece-chapter-1198/" -> "one-piece-chapter-1198" */
function slugFromPath(path: string | null): string | null {
  if (!path) return null;
  const clean = path.split('?')[0].replace(/\/+$/, '');
  const last = clean.split('/').filter(Boolean).pop();
  return last || null;
}

export async function generateMetadata({ params }: KomikChapterProps): Promise<Metadata> {
  const { slug, chapter } = await params;
  const view = await getKomikChapter(decodeURIComponent(slug), decodeURIComponent(chapter));
  const series = view?.seriesTitle || decodeURIComponent(slug).replaceAll('-', ' ');
  const title = view ? `${series} ${view.label}` : 'Baca komik';
  return {
    title,
    description: `Baca ${series} ${view?.label ?? ''} bahasa Indonesia di Aznime.`,
    alternates: {
      canonical: `/komik/${encodeURIComponent(decodeURIComponent(slug))}/${encodeURIComponent(decodeURIComponent(chapter))}`,
    },
    robots: view ? undefined : { index: false, follow: true },
  };
}

export const dynamic = 'force-dynamic';

export default async function KomikChapterPage({ params }: KomikChapterProps) {
  const { slug, chapter } = await params;
  const seriesSlug = decodeURIComponent(slug);
  const chapterSlug = decodeURIComponent(chapter);

  const [view, detail] = await Promise.all([
    getKomikChapter(seriesSlug, chapterSlug),
    getKomikDetail(seriesSlug).catch(() => null),
  ]);
  if (!view) notFound();

  const prevSlug = slugFromPath(view.prev);
  const nextSlug = slugFromPath(view.next);
  const seriesTitle = view.seriesTitle || detail?.title || seriesSlug.replaceAll('-', ' ');

  const navButton = (target: string | null, label: string, icon: 'prev' | 'next') => {
    const Icon = icon === 'prev' ? ChevronLeft : ChevronRight;
    const content = (
      <>
        {icon === 'prev' ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{label}</span>
        {icon === 'next' ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      </>
    );
    const base =
      'inline-flex h-10 items-center gap-1.5 rounded-[4px] border px-4 text-[12.5px] font-semibold transition-colors';
    if (!target) {
      return (
        <span
          aria-disabled="true"
          className={`${base} cursor-not-allowed border-white/5 text-zinc-600`}
        >
          {content}
        </span>
      );
    }
    return (
      <Link
        href={`/komik/${encodeURIComponent(seriesSlug)}/${encodeURIComponent(target)}`}
        className={`${base} border-white/15 text-white hover:border-white/40 hover:bg-white/[0.05]`}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/komik/${encodeURIComponent(seriesSlug)}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {seriesTitle}
          </Link>
          <h1 className="mt-1 truncate font-display text-[19px] font-semibold tracking-[-0.02em] text-white">
            {view.label}
          </h1>
        </div>
        <Link
          href={`/komik/${encodeURIComponent(seriesSlug)}#daftar-chapter`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-white/15 px-3 text-[12px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
          Chapter
        </Link>
      </div>

      <div className="flex flex-col items-center gap-1.5 bg-surface/40">
        {view.images.map((url, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${index}-${url.slice(-24)}`}
            src={`/api/img?u=${encodeURIComponent(url)}&w=900`}
            alt={`Halaman ${index + 1} ${seriesTitle} ${view.label}`}
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            className="h-auto w-full max-w-[900px] bg-[#141010]"
          />
        ))}
      </div>

      <nav aria-label="Navigasi chapter" className="mt-6 flex items-center justify-between gap-3">
        {navButton(prevSlug, 'Sebelumnya', 'prev')}
        {navButton(nextSlug, 'Berikutnya', 'next')}
      </nav>
    </div>
  );
}
