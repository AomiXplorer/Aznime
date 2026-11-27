import Link from 'next/link';
import { EyeOff, Settings } from 'lucide-react';

const LABELS = {
  hentai: 'Hentai',
  manhwa18: 'Manhwa 18+',
} as const;

/**
 * Pengganti isi /hentai dan /manhwa18 saat filter konten dewasa di Pengaturan
 * masih mati. Halamannya tetap bisa dibuka, tapi tidak menampilkan satu judul
 * pun sebelum filternya dinyalakan.
 */
export function AdultDisabled({ section }: { section: keyof typeof LABELS }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="border border-line bg-surface px-6 py-8 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-elevated text-zinc-400">
          <EyeOff className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-[21px] leading-tight text-white">
          {LABELS[section]} sedang disembunyikan
        </h1>
        <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-zinc-400">
          Filter konten dewasa di Pengaturan masih mati, jadi bagian ini tidak muncul di katalog
          dan tidak bisa dibuka lewat tautan langsung.
        </p>
        <Link
          href="/settings"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-[4px] bg-white px-4 text-[13px] font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Buka Pengaturan
        </Link>
      </div>
    </div>
  );
}
