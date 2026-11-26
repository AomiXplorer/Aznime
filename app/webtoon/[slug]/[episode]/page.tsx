import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { getWebtoonDetail, getWebtoonEpisode, parseWebtoonSlug } from '@/lib/comics';

interface WebtoonEpisodeProps {
  params: Promise<{ slug: string; episode: string }>;
}

export async function generateMetadata({ params }: WebtoonEpisodeProps): Promise<Metadata> {
  const { slug, episode } = await params;
  const parsed = parseWebtoonSlug(decodeURIComponent(slug));
  const episodeNo = Number(episode);
  if (!parsed || !Number.isFinite(episodeNo)) {
    return { title: 'Baca webtoon', robots: { index: false, follow: true } };
  }
  const view = await getWebtoonEpisode(parsed.titleNo, parsed.slug, episodeNo);
  /* view.title adalah judul episode ("EP.01"); nama seri diambil dari detail
     supaya judul halaman unik dan tidak sekadar mengulang nomor episode. */
  const series =
    (await getWebtoonDetail(parsed.titleNo, parsed.slug).then((d) => d?.title).catch(() => null)) ||
    parsed.slug.replaceAll('-', ' ');
  const title = view ? `${series} Episode ${episodeNo}` : 'Baca webtoon';
  return {
    title,
    description: `Baca ${series} episode ${episodeNo} bahasa Indonesia di Aznime.`,
    alternates: {
      canonical: `/webtoon/${parsed.titleNo}-${encodeURIComponent(parsed.slug)}/${episodeNo}`,
    },
    robots: view ? undefined : { index: false, follow: true },
  };
}

/* Tanpa ISR: 404 palsu akibat gangguan sesaat tidak boleh tersimpan. */
export const dynamic = 'force-dynamic';

export default async function WebtoonEpisodePage({ params }: WebtoonEpisodeProps) {
  const { slug, episode } = await params;
  const parsed = parseWebtoonSlug(decodeURIComponent(slug));
  const episodeNo = Number(episode);
  if (!parsed || !Number.isFinite(episodeNo)) notFound();

  const view = await getWebtoonEpisode(parsed.titleNo, parsed.slug, episodeNo);
  if (!view) {
    /* Episode yang memang tidak ada tetap 404; gambar yang gagal dimuat
       ditampilkan sebagai keadaan error supaya tidak tersimpan sebagai 404. */
    const detail = await getWebtoonDetail(parsed.titleNo, parsed.slug);
    const exists = detail?.episodes.some((episode) => episode.episodeNo === episodeNo);
    if (!exists) notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-[22px] font-semibold text-white">
          Gambar episode belum bisa dimuat
        </h1>
        <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-zinc-400">
          Episode ini ada di WEBTOON, tetapi server gambarnya tidak menjawab permintaan Aznime.
          Coba muat ulang beberapa saat lagi.
        </p>
        <Link
          href={`/webtoon/${parsed.titleNo}-${encodeURIComponent(parsed.slug)}`}
          className="mt-5 inline-flex h-10 items-center rounded-[4px] border border-white/15 px-4 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
        >
          Kembali ke daftar episode
        </Link>
      </div>
    );
  }

  const base = `/webtoon/${parsed.titleNo}-${encodeURIComponent(parsed.slug)}`;
  const navButton = (target: number | null, label: string, icon: 'prev' | 'next') => {
    const Icon = icon === 'prev' ? ChevronLeft : ChevronRight;
    const content = (
      <>
        {icon === 'prev' ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{label}</span>
        {icon === 'next' ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      </>
    );
    const baseClass =
      'inline-flex h-10 items-center gap-1.5 rounded-[4px] border px-4 text-[12.5px] font-semibold transition-colors';
    if (!target) {
      return (
        <span aria-disabled="true" className={`${baseClass} cursor-not-allowed border-white/5 text-zinc-600`}>
          {content}
        </span>
      );
    }
    return (
      <Link
        href={`${base}/${target}`}
        className={`${baseClass} border-white/15 text-white hover:border-white/40 hover:bg-white/[0.05]`}
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
            href={base}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {view.title || parsed.slug.replaceAll('-', ' ')}
          </Link>
          <h1 className="mt-1 truncate font-display text-[19px] font-semibold tracking-[-0.02em] text-white">
            Episode {episodeNo}
          </h1>
        </div>
        <Link
          href={`${base}#daftar-episode`}
          className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-white/15 px-3 text-[12px] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/[0.05]"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
          Episode
        </Link>
      </div>

      <div className="flex flex-col items-center bg-surface/40">
        {view.images.map((image, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${index}-${image.url.slice(-24)}`}
            src={`/api/img?u=${encodeURIComponent(image.url)}&w=900`}
            alt={`Halaman ${index + 1} episode ${episodeNo}`}
            width={image.width || undefined}
            height={image.height || undefined}
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-auto w-full max-w-[800px]"
          />
        ))}
      </div>

      <nav aria-label="Navigasi episode" className="mt-6 flex items-center justify-between gap-3">
        {navButton(view.prev, 'Sebelumnya', 'prev')}
        {navButton(view.next, 'Berikutnya', 'next')}
      </nav>
    </div>
  );
}
