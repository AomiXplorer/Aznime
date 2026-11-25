import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CONTRIBUTORS } from '@/lib/credits';
import { ContributorProfile } from '@/components/ContributorProfile';

export const metadata: Metadata = {
  title: 'Credits',
  description: 'Orang-orang di balik pengembangan Aznime.',
  alternates: { canonical: '/credit' },
};

// Aomi dan Azura tidak ditampilkan pada halaman Credits publik.
// Data utama tetap utuh karena masih dipakai oleh fitur lain.
const CREDIT_CONTRIBUTORS = CONTRIBUTORS.filter(
  ({ id }) => id !== 'aomi' && id !== 'azura'
);

export default function CreditPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-sm text-[12.5px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Kembali ke beranda
      </Link>

      <header className="mt-10 border-b border-line pb-8 sm:mt-14 sm:pb-10">
        <p className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-500">
          <span aria-hidden="true" className="h-px w-7 bg-accent" />
          Aznime · People
        </p>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,10vw,4.75rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-white">
          Credits
        </h1>
        <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed text-zinc-400">
          Orang-orang yang ikut membangun dan menjaga Aznime tetap berjalan.
        </p>
      </header>

      <section aria-labelledby="credit-contributors" className="mt-8 sm:mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="credit-contributors" className="text-[13px] font-semibold text-zinc-200">
            Kontributor
          </h2>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            {String(CREDIT_CONTRIBUTORS.length).padStart(2, '0')} contributors
          </span>
        </div>

        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {CREDIT_CONTRIBUTORS.map((contributor) => (
            <li key={contributor.id} className="min-w-0">
              <ContributorProfile contributor={contributor} variant="card" />
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 border-t border-line pt-5 sm:mt-12">
        <p className="text-[12.5px] leading-relaxed text-zinc-500">
          Terima kasih sudah mendukung perkembangan Aznime.
        </p>
      </footer>
    </main>
  );
}
