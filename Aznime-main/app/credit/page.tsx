import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CONTRIBUTORS } from '@/lib/credits';
import { ContributorProfile } from '@/components/ContributorProfile';

export const metadata: Metadata = {
  title: 'Credits',
  description: 'Behind the platform, powered by the people.',
  alternates: { canonical: '/credit' },
};

export default function CreditPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-8 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-sm text-[12.5px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Kembali ke beranda
      </Link>

      <header className="mt-10 grid gap-8 border-b border-line pb-9 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500">
            <span aria-hidden="true" className="h-px w-7 bg-accent" />
            Aznime · Contributors
          </p>
          <h1 className="mt-5 font-display text-[clamp(3.25rem,13vw,6rem)] font-semibold leading-[0.86] tracking-[-0.055em] text-white">
            Credits
          </h1>
          <p className="mt-6 max-w-[40ch] text-[15px] leading-relaxed text-zinc-300">
            Behind the platform, powered by the people.
          </p>
        </div>

        <p
          aria-hidden="true"
          className="hidden text-[10px] font-medium uppercase tracking-[0.42em] text-zinc-500 md:block [writing-mode:vertical-rl]"
        >
          Aznime · 2026
        </p>
      </header>

      <section aria-labelledby="credit-contributors" className="mt-1">
        <h2 id="credit-contributors" className="sr-only">
          Contributor Aznime
        </h2>
        <ol className="divide-y divide-line border-b border-line">
          {CONTRIBUTORS.map((contributor, position) => (
            <li key={contributor.id}>
              <ContributorProfile
                contributor={contributor}
                index={String(position + 1).padStart(2, '0')}
              />
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-14 max-w-2xl">
        <p className="text-[13px] leading-relaxed text-zinc-400">
          Aznime dirawat bergantian: katalog, server, dan tampilan dikerjakan manual. Kalau ada
          episode yang rusak atau tautan yang mati, kabari lewat kanal WhatsApp yang tersedia di
          atas.
        </p>
        <p className="mt-4 font-display text-[13px] font-semibold tracking-[-0.01em] text-zinc-300">
          Terima kasih sudah menonton.
        </p>
      </div>
    </div>
  );
}
