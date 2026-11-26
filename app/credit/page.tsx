import type { Metadata } from 'next';
import { socialMeta } from '@/lib/seo';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CONTRIBUTORS } from '@/lib/credits';
import { ContributorProfile } from '@/components/ContributorProfile';
import { PromotorSection } from '@/components/PromotorSection';

export const metadata: Metadata = {
  title: 'Credits',
  description: 'Behind the platform, powered by the people.',
  alternates: { canonical: '/credit' },
  ...socialMeta('Credits',
    'Behind the platform, powered by the people.'),
};

export default function CreditPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-8 sm:px-8">
      <style>{`
        @keyframes creditFadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes redDashGlint {
          0%, 100% {
            transform: translateX(-120%);
          }
          55% {
            transform: translateX(120%);
          }
        }
        .credit-fade-up {
          animation: creditFadeUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .red-dash-glint,
        .contributors-list span.bg-accent:not(.rounded-full) {
          position: relative;
          display: inline-block;
          height: 1.5px;
          overflow: hidden;
          transition: width 0.3s ease;
        }
        .red-dash-glint::after,
        .contributors-list span.bg-accent:not(.rounded-full)::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 241, 242, 0.95), transparent);
          animation: redDashGlint 2.8s ease-in-out infinite;
        }
        .contributors-list li:hover span.bg-accent:not(.rounded-full) {
          width: 2.5rem;
        }
        .contributors-list li img {
          transition: transform 0.3s ease-out;
        }
        .contributors-list li:hover img {
          transform: scale(1.04);
        }
      `}</style>

      <Link
        href="/"
        className="group inline-flex items-center gap-2 rounded-sm text-[12.5px] font-medium text-zinc-400 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <ArrowLeft
          className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
        Kembali ke beranda
      </Link>

      <header className="credit-fade-up group/head mt-10 grid gap-8 border-b border-line pb-9 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500">
            <span
              aria-hidden="true"
              className="red-dash-glint w-7 bg-accent group-hover/head:w-11"
            />
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
        <ol className="contributors-list divide-y divide-line border-b border-line">
          {CONTRIBUTORS.map((contributor, position) => (
            <li
              key={contributor.id}
              style={{ animationDelay: `${(position + 1) * 75}ms` }}
              className="credit-fade-up relative after:pointer-events-none after:absolute after:bottom-[-1px] after:left-0 after:h-[1.5px] after:w-0 after:bg-accent/80 after:transition-all after:duration-500 after:ease-out hover:after:w-full"
            >
              <ContributorProfile
                contributor={contributor}
                index={String(position + 1).padStart(2, '0')}
              />
            </li>
          ))}
        </ol>
      </section>

      <PromotorSection />

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
