import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Download, Film as FilmIcon, Tag } from 'lucide-react';
import { FilmUnavailable, filmPosterUrl, getFilmDetail } from '@/lib/film';
import { RevealImage } from '@/components/media/RevealImage';
import { FilmPlayer } from '@/components/film/FilmPlayer';
import { socialMeta } from '@/lib/seo';

export const revalidate = 900;

interface FilmDetailPageProps {
  params: Promise<{ slug: string[] }>;
}

function posterSrc(poster: string | null, width: number): string | null {
  return filmPosterUrl(poster, width);
}

export async function generateMetadata({ params }: FilmDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const detail = await getFilmDetail(slug.join('/'));
    const title = detail.title;
    const description = (detail.synopsis || `Nonton ${title} subtitle Indonesia di Aznime.`).slice(0, 160);
    return {
      title,
      description,
      alternates: { canonical: `/film/${detail.sourcePath}` },
      ...socialMeta(title, description),
    };
  } catch {
    return { title: 'Film' };
  }
}

export default async function FilmDetailPage({ params }: FilmDetailPageProps) {
  const { slug } = await params;
  const sourcePath = slug.join('/');

  let detail;
  try {
    detail = await getFilmDetail(sourcePath);
  } catch (error) {
    const offline = error instanceof FilmUnavailable;
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/film"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Semua film
        </Link>
        <div className="rounded-lg border border-[#2b2222] bg-[#131010] px-6 py-14 text-center">
          <FilmIcon className="mx-auto mb-3 h-6 w-6 text-zinc-600" aria-hidden="true" />
          <h1 className="font-display text-lg font-semibold text-zinc-100">
            {offline ? 'Sumber film sedang tidak tersedia' : 'Film tidak bisa dimuat'}
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-400">
            {offline
              ? 'Server nontonfilm.digital sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi.'
              : 'Judul ini tidak ditemukan di sumber.'}
          </p>
        </div>
      </div>
    );
  }

  const poster = posterSrc(detail.poster, 480);
  const srcSet = detail.poster
    ? [240, 480].map((width) => `${posterSrc(detail.poster, width)} ${width}w`).join(', ')
    : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/film"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Semua film
      </Link>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <div className="hidden lg:block">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface ring-1 ring-inset ring-white/10">
            <RevealImage
              src={poster}
              srcSet={srcSet}
              sizes="220px"
              alt={detail.title}
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
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">
            {detail.title}
          </h1>

          {detail.meta.length > 0 ? (
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
              {detail.meta.map((entry) => (
                <div key={`${entry.label}-${entry.value}`} className="flex gap-1.5">
                  <dt className="text-zinc-500">{entry.label}</dt>
                  <dd className="text-zinc-300">{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {detail.genres.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
              {detail.genres.slice(0, 8).map((genre) => (
                <span
                  key={genre}
                  className="rounded-[3px] border border-[#2b2222] px-1.5 py-[3px] text-[11px] leading-none text-zinc-400"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}

          {detail.synopsis ? (
            <p className="mt-4 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">{detail.synopsis}</p>
          ) : null}

          <div className="mt-6">
            <FilmPlayer embeds={detail.embeds} title={detail.title} />
          </div>

          {detail.downloads.length > 0 ? (
            <section aria-label="Unduhan" className="mt-8">
              <h2 className="mb-3 flex items-center gap-1.5 border-b border-[#2b2222] pb-2 font-display text-[15px] font-semibold text-white">
                <Download className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                Unduh
              </h2>
              <div className="flex flex-wrap gap-2">
                {detail.downloads.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="rounded-md border border-[#2b2222] px-2.5 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <p className="mt-8 text-[11.5px] leading-relaxed text-zinc-600">
            Pemutar dan tautan unduhan berasal dari nontonfilm.digital, bukan dari server Aznime.
          </p>
        </div>
      </div>
    </div>
  );
}
