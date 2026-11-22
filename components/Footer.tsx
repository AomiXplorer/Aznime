import Link from 'next/link';

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
    <footer className="mt-16 border-t border-white/[0.06] py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Link href="/" className="text-xl font-extrabold tracking-tight text-accent">
            Aznime
          </Link>
          <p className="mt-1 max-w-sm text-xs">
            Streaming anime subtitle Indonesia dengan katalog langsung dan trailer AniList.
          </p>
        </div>
        <nav aria-label="Tautan footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
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
