import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ListOrdered } from 'lucide-react';
import { getWebtoonDetail, parseWebtoonSlug } from '@/lib/comics';
import { socialMeta } from '@/lib/seo';

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
  const firstEpisode = detail.episodes[detail.episodes.length - 1];

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
            {detail.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.poster}
                alt={detail.title}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-zinc-600">
                Tanpa poster
              </div>
            )}
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

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {firstEpisode ? (
              <Link
                href={`/webtoon/${detail.titleNo}-${encodeURIComponent(detail.slug)}/${firstEpisode.episodeNo}`}
                className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-white px-5 text-[13px] font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Baca episode pertama
              </Link>
            ) : null}
            {detail.episodes.length > 0 ? (
              <a
                href="#daftar-episode"
                className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/15 px-4 text-[13px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
              >
                <ListOrdered className="h-4 w-4" aria-hidden="true" />
                {detail.episodes.length} episode
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <section id="daftar-episode" className="mt-10 scroll-mt-20">
        <div className="mb-3 flex items-end justify-between gap-4 border-b border-[#2b2222] pb-2">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-white">
            Daftar episode
          </h2>
          <p className="text-[11.5px] text-zinc-500">{detail.episodes.length} episode</p>
        </div>

        {detail.episodes.length === 0 ? (
          <p className="py-6 text-[13px] text-zinc-400">Belum ada episode yang bisa dibaca.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {detail.episodes.map((episode) => (
              <li key={episode.episodeNo}>
                <Link
                  href={`/webtoon/${detail.titleNo}-${encodeURIComponent(detail.slug)}/${episode.episodeNo}`}
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
        )}
      </section>
    </div>
  );
}
