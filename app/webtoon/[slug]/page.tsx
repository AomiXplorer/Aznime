import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { ChevronLeft, ListOrdered } from 'lucide-react';
import { getWebtoonDetail, getWebtoonEpisodes, parseWebtoonSlug, webtoonHref } from '@/lib/comics';
import type { WebtoonEpisodeSummary } from '@/lib/comics';
import { Skeleton } from '@/components/Skeleton';
import { socialMeta } from '@/lib/seo';
import { RevealImage } from '@/components/media/RevealImage';

interface WebtoonDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: WebtoonDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseWebtoonSlug(decodeURIComponent(slug));
  if (!parsed) return { title: 'Webtoon tidak ditemukan', robots: { index: false, follow: true } };

  const detail = await getWebtoonDetail(parsed.titleNo, parsed.slug);
  if (!detail) return { title: 'Webtoon tidak ditemukan', robots: { index: false, follow: true } };

  const description = detail.synopsis
    ? detail.synopsis.slice(0, 155).trim()
    : `Baca ${detail.title} bahasa Indonesia di Aznime.`;
  return {
    title: detail.title,
    description,
    alternates: { canonical: `/webtoon/${detail.titleNo}-${encodeURIComponent(detail.slug)}` },
    ...socialMeta(detail.title, description),
  };
}

/* Tanpa ISR: kegagalan sumber yang sesaat tidak boleh ikut di-cache. */
export const dynamic = 'force-dynamic';

export default async function WebtoonDetailPage({ params }: WebtoonDetailProps) {
  const { slug } = await params;
  const parsed = parseWebtoonSlug(decodeURIComponent(slug));
  if (!parsed) notFound();

  const episodes = getWebtoonEpisodes(parsed.titleNo);
  const detail = await getWebtoonDetail(parsed.titleNo, parsed.slug);
  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-[22px] font-semibold text-white">
          Webtoon belum bisa dimuat
        </h1>
        <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-zinc-400">
          Sumber WEBTOON tidak menjawab permintaan ini. Halaman tidak dianggap hilang, jadi
          coba muat ulang beberapa saat lagi.
        </p>
        <Link
          href="/webtoon"
          className="mt-5 inline-flex h-10 items-center rounded-[4px] border border-white/15 px-4 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
        >
          Kembali ke katalog webtoon
        </Link>
      </div>
    );
  }

  const info = [detail.genre, detail.status, detail.author].filter(Boolean).join(' · ');
  const base = webtoonHref(detail.titleNo, detail.slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/webtoon"
        className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-400 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Semua webtoon
      </Link>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] lg:grid-cols-[248px_1fr] lg:gap-9">
        <div className="mx-auto w-[168px] sm:w-[196px] md:mx-0 md:w-full">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[6px] bg-surface ring-1 ring-inset ring-white/10">
            <RevealImage
              src={
                detail.poster
                  ? `/api/img?u=${encodeURIComponent(detail.poster)}&w=420`
                  : null
              }
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
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            Webtoon
          </p>
          <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[32px]">
            {detail.title}
          </h1>
          {info ? <p className="mt-2 text-[12.5px] text-zinc-400">{info}</p> : null}

          {detail.tags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {detail.tags.slice(0, 8).map((tag) => (
                <li
                  key={tag}
                  className="rounded-[3px] border border-white/10 px-2 py-1 text-[11px] text-zinc-300"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          {detail.synopsis ? (
            <p className="mt-5 max-w-[68ch] whitespace-pre-line text-[13.5px] leading-relaxed text-zinc-300">
              {detail.synopsis}
            </p>
          ) : null}

          <Suspense fallback={<Skeleton className="mt-6 h-10 w-44" />}>
            <EpisodeActions base={base} episodes={episodes} />
          </Suspense>
        </div>
      </div>

      <section id="daftar-episode" className="mt-10 scroll-mt-20">
        <h2 className="mb-3 border-b border-line-soft pb-2 font-display text-[17px] font-semibold tracking-[-0.02em] text-white">
          Daftar episode
        </h2>
        <Suspense fallback={
          <div role="status">
            <span className="sr-only">Memuat daftar episode</span>
            <Skeleton className="h-24 w-full" />
          </div>
        }>
          <EpisodeList base={base} episodes={episodes} />
        </Suspense>
      </section>
    </div>
  );
}

interface EpisodeLinksProps {
  base: string;
  episodes: Promise<WebtoonEpisodeSummary[] | null>;
}

async function EpisodeActions({ base, episodes }: EpisodeLinksProps) {
  const list = await episodes;
  if (!list?.length) return null;

  const firstEpisode = list.reduce((first, episode) =>
    episode.episodeNo < first.episodeNo ? episode : first
  );

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <Link
        href={`${base}/${firstEpisode.episodeNo}`}
        className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-white px-5 text-[13px] font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Baca episode pertama
      </Link>
      <a
        href="#daftar-episode"
        className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/15 px-4 text-[13px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
      >
        <ListOrdered className="h-4 w-4" aria-hidden="true" />
        {list.length} episode
      </a>
    </div>
  );
}

async function EpisodeList({ base, episodes }: EpisodeLinksProps) {
  const list = await episodes;
  if (!list?.length) {
    return (
      <p className="py-6 text-[13px] text-zinc-400">
        {list ? 'Belum ada episode yang bisa dibaca.' : 'Daftar episode belum bisa dimuat. Coba muat ulang.'}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((episode) => (
        <li key={episode.episodeNo}>
          <Link
            href={`${base}/${episode.episodeNo}`}
            className="flex h-11 items-center justify-between gap-3 border-b border-line-soft/60 text-[13px] text-zinc-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span className="truncate">{episode.title}</span>
            {episode.date ? (
              <span className="shrink-0 text-[11.5px] text-zinc-500">
                {new Date(episode.date).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
