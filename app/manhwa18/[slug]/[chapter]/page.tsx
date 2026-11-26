import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { cleanChapterSlug, manhwaChapterHref, getManhwaChapter, seriesSlugFromChapter } from '@/lib/mangasusuku';
import { RevealImage } from '@/components/media/RevealImage';

interface ManhwaChapterProps {
  params: Promise<{ slug: string; chapter: string }>;
}

export async function generateMetadata({ params }: ManhwaChapterProps): Promise<Metadata> {
  const { slug, chapter } = await params;
  const view = await getManhwaChapter(decodeURIComponent(slug), decodeURIComponent(chapter));
  const series = view?.seriesTitle || decodeURIComponent(slug).replaceAll('-', ' ');
  return {
    title: view ? `${series} ${view.label}` : 'Baca manhwa 18+',
    description: `Baca ${series} ${view?.label ?? ''} bahasa Indonesia di Aznime.`,
    robots: { index: false, follow: false, nocache: true },
  };
}

export const dynamic = 'force-dynamic';

export default async function ManhwaChapterPage({ params }: ManhwaChapterProps) {
  const { slug, chapter } = await params;
  const chapterSlug = cleanChapterSlug(decodeURIComponent(chapter));

  const view = await getManhwaChapter(decodeURIComponent(slug), chapterSlug);
  if (!view) notFound();

  const seriesSlug = view.seriesSlug || seriesSlugFromChapter(chapterSlug) || decodeURIComponent(slug);
  const seriesTitle = view.seriesTitle || seriesSlug.replaceAll('-', ' ');

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
        <span aria-disabled="true" className={`${base} cursor-not-allowed border-white/5 text-zinc-600`}>
          {content}
        </span>
      );
    }
    return (
      <Link
        href={manhwaChapterHref(seriesSlug, target)}
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
            href={`/manhwa18/${encodeURIComponent(seriesSlug)}`}
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
          href={`/manhwa18/${encodeURIComponent(seriesSlug)}#daftar-chapter`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-white/15 px-3 text-[12px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
          Chapter
        </Link>
      </div>

      <div className="flex flex-col items-center gap-1.5 bg-surface/40">
        {view.images.map((_url, index) => (
          <RevealImage
            key={`${chapterSlug}-${index}`}
            src={`/api/manhwa-page?s=${encodeURIComponent(chapterSlug)}&i=${index}&w=900`}
            alt={`Halaman ${index + 1} ${seriesTitle} ${view.label}`}
            fill={false}
            priority={index < 2}
            frameClassName="reader-page max-w-[900px]"
            className="mx-auto max-w-[900px]"
          />
        ))}
      </div>

      <nav aria-label="Navigasi chapter" className="mt-6 flex items-center justify-between gap-3">
        {navButton(view.prev, 'Sebelumnya', 'prev')}
        {navButton(view.next, 'Berikutnya', 'next')}
      </nav>
    </div>
  );
}
