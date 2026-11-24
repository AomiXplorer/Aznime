import type { Metadata } from 'next';
import Link from 'next/link';
<<<<<<< HEAD
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import { CREDITS } from '@/lib/credits';

export const metadata: Metadata = {
  title: 'Kredit & Salam Hangat',
  description:
    'Salam hangat buat penonton Aznime, plus kenalan sama orang-orang yang merawat situs ini setiap hari.',
=======
import { ArrowLeft } from 'lucide-react';
import { CONTRIBUTORS } from '@/lib/credits';
import { ContributorProfile } from '@/components/ContributorProfile';

export const metadata: Metadata = {
  title: 'Credits',
  description: 'Behind the platform, powered by the people.',
>>>>>>> c5dfbd0 (Update maintennace)
  alternates: { canonical: '/credit' },
};

export default function CreditPage() {
  return (
<<<<<<< HEAD
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Balik ke beranda
      </Link>

      <header className="mt-8">
        <p className="inline-flex items-center gap-1.5 rounded-[4px] bg-accent/15 px-3 py-1 text-[12px] font-semibold text-rose-300">
          <Heart className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          Salam hangat
        </p>
        <h1 className="mt-4 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[34px]">
          Halo, penonton. Makasih ya sudah mampir.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-300">
          Aznime bukan situs besar dengan tim puluhan orang. Situs ini dirawat manual, biasanya
          sambil ngopi dan kadang sambil begadang. Kalau ada episode yang telat muncul, server yang
          ngambek, atau tampilan yang terasa aneh, itu bukan salah kamu. Kami yang sedang beresin.
        </p>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
          Nggak ada akun, nggak ada langganan, nggak ada tagihan bulanan. Cukup buka, pilih anime,
          terus nonton. Kalau mau balas budi, nonton sampai habis dan share ke teman sudah lebih dari
          cukup.
        </p>
      </header>

      <section aria-labelledby="orang-di-balik-aznime" className="mt-10">
        <h2 id="orang-di-balik-aznime" className="text-[1.05rem] font-bold text-white">
          Yang bikin situs ini tetap hidup
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          Kalau mau kirim salam, masukan, atau laporan episode rusak, sapa langsung lewat channel
          WhatsApp di bawah.
        </p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {CREDITS.map((credit) => (
            <li key={credit.name}>
              <a
                href={credit.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${credit.channelLabel} (dibuka di tab baru)`}
                className="group flex h-full flex-col justify-between gap-4 rounded-[6px] border border-[#2b2222] bg-surface p-4 transition-colors duration-150 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <div>
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
                  >
                    {credit.name.charAt(0)}
                  </span>
                  <p className="mt-3 text-[15px] font-bold text-white">{credit.name}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                    Bagian dari orang yang menjaga katalog, server, dan tampilan Aznime.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-300 transition-colors group-hover:text-rose-200">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {credit.channelLabel}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-[6px] border border-[#2b2222] bg-surface p-5">
        <h2 className="text-[15px] font-bold text-white">Sedikit titip pesan</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-300">
          Kami suka anime, dan kami senang kalau kamu juga suka. Jadi kalau ada yang kurang pas,
          ceritakan saja dengan tenang. Masukan yang jelas lebih gampang kami kerjakan daripada
          marah-marah di kolom komentar.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
          Selamat nonton, jangan lupa istirahat, dan jangan lupa makan.
        </p>
        <p className="mt-4 text-[13px] font-semibold text-zinc-500">— Aomi &amp; Azura</p>
      </section>
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
    </div>
  );
}
