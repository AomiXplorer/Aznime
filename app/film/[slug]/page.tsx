import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ExternalLink, Play } from 'lucide-react';
import { getRumahFilmDetail } from '@/lib/scrapers/rumahfilm';
import { socialMeta } from '@/lib/seo';
import { EmptyState } from '@/components/EmptyState';
import { RevealImage } from '@/components/media/RevealImage';

interface FilmDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FilmDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getRumahFilmDetail(decodeURIComponent(slug));
  if (!result.detail) {
    return {
      title: result.offline ? 'Film sementara tidak tersedia' : 'Film tidak ditemukan',
      robots: { index: false, follow: true },
    };
  }

  const description = result.detail.synopsis
    ? result.detail.synopsis.slice(0, 155).trim()
    : `Informasi film ${result.detail.title} di Aznime.`;

  return {
    title: result.detail.title,
    description,
    alternates: { canonical: `/film/${encodeURIComponent(result.detail.slug)}` },
    ...socialMeta(result.detail.title, description),
  };
}

export const dynamic = 'force-dynamic';

export default async function FilmDetailPage({ params }: FilmDetailProps) {
  const { slug } = await params;
  const result = await getRumahFilmDetail(decodeURIComponent(slug));

  if (result.notFound) {
    notFound();
  }

  if (result.offline || !result.detail) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/film"
          className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Semua film
        </Link>
        <EmptyState
          title="Detail film sementara tidak bisa dimuat"
          description="rumahfilm.net menolak atau belum merespons permintaan dari server Aznime saat ini. Coba lagi beberapa saat lagi."
          actionLabel="Kembali ke katalog film"
          actionHref="/film"
        />
      </div>
    );
  }

  const detail = result.detail;
  const info = [
    detail.year ? String(detail.year) : null,
    detail.rating !== undefined ? `★ ${detail.rating.toFixed(1)}` : null,
    detail.duration,
    detail.country,
  ]
    .filter(Boolean)
    .join(' · ');

  const extraFields = [
    detail.director ? { label: 'Sutradara', value: detail.director } : null,
    detail.releaseDate ? { label: 'Tanggal rilis', value: detail.releaseDate } : null,
    detail.cast && detail.cast.length > 0
      ? { label: 'Pemeran', value: detail.cast.slice(0, 8).join(', ') }
      : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/film"
        className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Semua film
      </Link>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] lg:grid-cols-[248px_1fr] lg:gap-9">
        <div className="mx-auto w-[168px] sm:w-[196px] md:mx-0 md:w-full">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[6px] bg-surface ring-1 ring-inset ring-white/10">
            <RevealImage
              src={detail.poster || null}
              alt={detail.title}
              sizes="(max-width: 768px) 168px, 248px"
              referrerPolicy="no-referrer"
              className="object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center text-[12px] text-zinc-600">
                  Tanpa poster
                </div>
              }
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-zinc-500">Film</p>
          <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[32px]">
            {detail.title}
          </h1>
          {detail.originalTitle ? (
            <p className="mt-1 text-[12.5px] text-zinc-500">{detail.originalTitle}</p>
          ) : null}
          {info ? <p className="mt-3 text-[12.5px] text-zinc-400">{info}</p> : null}

          {detail.genres && detail.genres.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {detail.genres.map((genre) => (
                <li
                  key={genre}
                  className="rounded-[3px] border border-white/10 px-2 py-1 text-[11px] text-zinc-300"
                >
                  {genre}
                </li>
              ))}
            </ul>
          ) : null}

          {detail.synopsis ? (
            <p className="mt-5 max-w-[68ch] whitespace-pre-line text-[13.5px] leading-relaxed text-zinc-300">
              {detail.synopsis}
            </p>
          ) : null}

          {extraFields.length > 0 ? (
            <dl className="mt-5 grid max-w-[68ch] gap-2 border-t border-line-soft/60 pt-4 text-[12.5px] sm:grid-cols-2">
              {extraFields.map((field) => (
                <div key={field.label}>
                  <dt className="text-zinc-500">{field.label}</dt>
                  <dd className="mt-0.5 text-zinc-200">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {detail.streamUrls && detail.streamUrls.length > 0 ? (
              <a
                href="#tonton-film"
                className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-white px-5 text-[13px] font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Tonton film
              </a>
            ) : null}
            <a
              href={detail.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={
                detail.streamUrls && detail.streamUrls.length > 0
                  ? 'inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/15 px-4 text-[13px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
                  : 'inline-flex h-10 items-center gap-2 rounded-[4px] bg-white px-5 text-[13px] font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
              }
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Buka di RumahFilm
            </a>
          </div>
        </div>
      </div>

      {detail.streamUrls && detail.streamUrls.length > 0 ? (
        <section id="tonton-film" className="mt-10 scroll-mt-20">
          <div className="mb-3 flex items-end justify-between gap-4 border-b border-[#2b2222] pb-2">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white">
              Sumber Pemutar
            </h2>
            <p className="text-[11.5px] text-zinc-500">{detail.streamUrls.length} tautan</p>
          </div>

          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {detail.streamUrls.map((stream) => (
              <li key={stream.url}>
                <a
                  href={stream.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-between gap-3 border-b border-line-soft/60 text-[13px] text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <span className="truncate">{stream.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
