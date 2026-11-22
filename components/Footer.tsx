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
    <footer className="mt-20 border-t border-line bg-surface/50 py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-display text-xl font-extrabold leading-none text-ink"
          >
            <span aria-hidden="true" className="h-4 w-1 rounded-full bg-accent" />
            <span>
              Aznime<span className="text-accent">.</span>
            </span>
          </Link>
          <p className="mt-3 text-[13px] leading-relaxed">
            Streaming anime subtitle Indonesia dengan katalog langsung dan trailer AniList.
          </p>
        </div>
        <nav aria-label="Tautan footer" className="flex flex-wrap gap-x-6 gap-y-2.5 text-[13px] md:max-w-md md:justify-end">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors duration-150 hover:text-accent-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
