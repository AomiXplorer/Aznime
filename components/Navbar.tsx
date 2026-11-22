'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Menu, Search, X } from 'lucide-react';

/* Dialog pencarian membawa motion + logika pencarian. Tidak dibutuhkan pada
   render awal, jadi dimuat terpisah dan baru dipasang saat pertama dibuka. */
const SearchDialog = dynamic(
  () => import('./SearchDialog').then((m) => m.SearchDialog),
  { ssr: false }
);

const NAV_LINKS = [
  { href: '/', label: 'Beranda' },
  { href: '/anime', label: 'Katalog' },
  { href: '/ongoing', label: 'Ongoing' },
  { href: '/completed', label: 'Completed' },
  { href: '/schedule', label: 'Jadwal' },
] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  // Sekali dibuka, dialog tetap terpasang supaya animasi keluar berjalan normal.
  const [searchMounted, setSearchMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // IntersectionObserver pada sentinel 1px di paling atas dokumen.
  // Tidak ada listener scroll sama sekali, jadi navbar tidak pernah
  // memicu re-render per frame saat halaman digulir.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      const onScroll = () => setScrolled(window.scrollY > 24);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => setScrolled(!entries[0].isIntersecting),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchMounted(true);
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  // Di beranda, bar transparan di atas hero lalu menjadi solid saat scroll.
  const transparent = pathname === '/' && !scrolled && !mobileOpen;

  return (
    <>
      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-6 w-px"
      />
      <header className="sticky top-0 z-40 isolate">
        {/* Latar solid tanpa backdrop-filter: blur pada elemen sticky memaksa
            browser me-render ulang seluruh area di belakangnya setiap frame
            saat scroll, dan itu penyebab utama scroll tersendat di Android. */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 border-b border-line bg-canvas transition-opacity duration-200 ${
            transparent ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 bg-gradient-to-b from-canvas/90 to-transparent transition-opacity duration-200 ${
            transparent ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-sm font-display text-[1.4rem] font-bold leading-none tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
          >
            <span aria-hidden="true" className="h-5 w-1 bg-accent" />
            Aznime
          </Link>

          <nav aria-label="Navigasi utama" className="hidden h-full flex-1 items-stretch gap-7 md:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center whitespace-nowrap text-[13.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${
                    active ? 'font-bold text-ink' : 'font-medium text-muted hover:text-ink'
                  }`}
                >
                  {link.label}
                  {active ? (
                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <button
              type="button"
              onClick={() => {
                setSearchMounted(true);
                setSearchOpen(true);
              }}
              aria-label="Buka pencarian anime"
              className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface px-3 text-[13px] text-muted transition-colors duration-150 hover:border-white/20 hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink sm:w-52 lg:w-60"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden flex-1 text-left sm:inline">Cari anime</span>
              <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-sans text-[11px] text-faint lg:inline">
                Ctrl K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((p) => !p)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-line bg-surface text-ink transition-colors hover:bg-elevated md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink"
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav
            id="mobile-nav-panel"
            aria-label="Navigasi mobile"
            className="page-enter border-t border-line bg-canvas px-4 pb-4 pt-2 md:hidden"
          >
            <ul>
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href} className="border-b border-line last:border-b-0">
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 py-3.5 text-[15px] transition-colors ${
                        active ? 'font-bold text-ink' : 'font-medium text-muted hover:text-ink'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-4 w-0.5 ${active ? 'bg-accent' : 'bg-transparent'}`}
                      />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </header>

      {searchMounted ? (
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      ) : null}
    </>
  );
}
