import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ListOrdered } from 'lucide-react';
import { getKomikDetail } from '@/lib/comics';
import { socialMeta } from '@/lib/seo';
import { RevealImage } from '@/components/media/RevealImage';

interface KomikDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: KomikDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getKomikDetail(decodeURIComponent(slug));
  if (!detail) {
    return { title: 'Komik tidak ditemukan', robots: { index: false, follow: true } };
  }
  const description = detail.synopsis
    ? detail.synopsis.slice(0, 155).trim()
    : `Baca ${detail.title} bahasa Indonesia lengkap di Aznime.`;
  return {
    title: detail.title,
    description,
    alternates: { canonical: `/komik/${encodeURIComponent(detail.slug)}` },
    ...socialMeta(detail.title, description),
  };
}

/* Tanpa ISR: komiku.org bisa menolak sementara, hasilnya tidak di-cache. */
export const dynamic = 'force-dynamic';

export default async function KomikDetailPage({ params }: KomikDetailProps) {
  const { slug } = await params;
  const detail = await getKomikDetail(decodeURIComponent(slug));
  if (!detail) notFound();

  const info = [detail.type, detail.status, detail.author].filter(Boolean).join(' · ');
  const firstChapter = detail.chapters[detail.chapters.length - 1];
  const poster = detail.poster
    ? `/api/img?u=${encodeURIComponent(detail.poster)}&w=420`
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/komik"
        className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Semua komik
      </Link>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] lg:grid-cols-[248px_1fr] lg:gap-9">
        <div className="mx-auto w-[168px] sm:w-[196px] md:mx-0 md:w-full">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[6px] bg-surface ring-1 ring-inset ring-white/10">
            <RevealImage
              src={poster}
              alt={detail.title}
              sizes="(max-width: 768px) 168px, 248px"
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
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-zinc-500">Komik</p>
          <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[32px]">
            {detail.title}
          </h1>
          {detail.altTitle ? (
            <p className="mt-1 text-[12.5px] text-zinc-500">{detail.altTitle}</p>
          ) : null}
          {info ? <p className="mt-3 text-[12.5px] text-zinc-400">{info}</p> : null}

          {detail.genres.length > 0 ? (
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

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {firstChapter ? (
              <Link
                href={`/komik/${encodeURIComponent(detail.slug)}/${encodeURIComponent(firstChapter.slug)}`}
                className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-white px-5 text-[13px] font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Baca chapter pertama
              </Link>
            ) : null}
            {detail.chapters.length > 0 ? (
              <a
                href="#daftar-chapter"
                className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/15 px-4 text-[13px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
              >
                <ListOrdered className="h-4 w-4" aria-hidden="true" />
                {detail.chapters.length} chapter
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <section id="daftar-chapter" className="mt-10 scroll-mt-20">
        <div className="mb-3 flex items-end justify-between gap-4 border-b border-[#2b2222] pb-2">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white">
            Daftar chapter
          </h2>
          <p className="text-[11.5px] text-zinc-500">{detail.chapters.length} chapter</p>
        </div>

        {detail.chapters.length === 0 ? (
          <p className="py-6 text-[13px] text-zinc-400">Belum ada chapter yang bisa dibaca.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {detail.chapters.map((chapter) => (
              <li key={chapter.slug}>
                <Link
                  href={`/komik/${encodeURIComponent(detail.slug)}/${encodeURIComponent(chapter.slug)}`}
                  className="flex h-11 items-center justify-between gap-3 border-b border-line-soft/60 text-[13px] text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <span className="truncate">{chapter.label}</span>
                  {chapter.date ? (
                    <span className="shrink-0 text-[11.5px] text-zinc-500">{chapter.date}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
