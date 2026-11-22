import Link from 'next/link';
import { Wordmark } from './Wordmark';

const LINKS = [
  { href: '/', label: 'Beranda' },
  { href: '/anime', label: 'Katalog' },
  { href: '/ongoing', label: 'Ongoing' },
  { href: '/completed', label: 'Completed' },
  { href: '/schedule', label: 'Jadwal' },
  { href: '/search', label: 'Cari' },
  { href: '/credit', label: 'Kredit' },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-[#2b2222] py-10 text-[13px] text-zinc-500">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Link href="/" aria-label="Aznime, ke beranda" className="inline-block text-xl">
            <Wordmark />
          </Link>
          <p className="mt-2 max-w-[38ch] text-[12px] leading-relaxed text-zinc-500">
            Streaming anime subtitle Indonesia. Katalog langsung, jadwal tayang harian.
          </p>
        </div>
        <nav aria-label="Tautan footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
