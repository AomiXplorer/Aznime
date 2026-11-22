'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Menu, Search, X } from 'lucide-react';
import { Wordmark } from './Wordmark';

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
  // Di bagian dewasa, tombol cari ikut mencari katalog Nekopoi.
  const adult = pathname === '/hentai' || pathname.startsWith('/hentai/');
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
          className={`absolute inset-0 -z-10 border-b border-[#241d1d] bg-canvas/95 transition-opacity duration-300 ${
            transparent ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
            transparent ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Aznime, ke beranda"
            className="shrink-0 rounded-sm text-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Wordmark />
          </Link>

          <nav aria-label="Navigasi utama" className="hidden flex-1 items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative whitespace-nowrap text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    active
                      ? 'font-semibold text-white after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-full after:bg-accent'
                      : 'font-medium text-zinc-400 hover:text-white'
                  }`}
                >
                  {link.label}
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
              aria-label={adult ? 'Buka pencarian hentai' : 'Buka pencarian anime'}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[4px] border border-white/10 bg-white/[0.03] px-3 text-[12.5px] text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{adult ? 'Cari hentai' : 'Cari anime'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((p) => !p)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[4px] border border-white/10 text-zinc-200 transition-colors duration-150 hover:border-white/25 hover:text-white md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav
            id="mobile-nav-panel"
            aria-label="Navigasi mobile"
            className="page-enter border-t border-[#241d1d] bg-canvas px-4 pb-4 pt-3 md:hidden"
          >
            <ul className="space-y-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between rounded-[4px] px-3 py-2.5 text-[13.5px] transition-colors ${
                        active
                          ? 'bg-white/[0.07] font-semibold text-white'
                          : 'font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
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
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} adult={adult} />
      ) : null}
    </>
  );
}
