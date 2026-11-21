'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, Search, X } from 'lucide-react';
import { SearchDialog } from './SearchDialog';

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Di beranda, bar transparan di atas hero lalu menjadi solid saat scroll.
  const transparent = pathname === '/' && !scrolled && !mobileOpen;

  return (
    <>
      <header className="sticky top-0 z-40 isolate">
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 border-b border-white/[0.06] bg-canvas/95 backdrop-blur-md transition-opacity duration-300 ${
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
            className="shrink-0 rounded-md text-[1.55rem] font-extrabold tracking-tight text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Aznime
          </Link>

          <nav aria-label="Navigasi utama" className="hidden flex-1 items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap text-[13.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    active ? 'font-bold text-white' : 'font-medium text-zinc-300 hover:text-white'
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
              onClick={() => setSearchOpen(true)}
              aria-label="Buka pencarian anime"
              className="group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white/[0.08] px-3.5 text-[13px] text-zinc-200 transition-all duration-200 hover:bg-white/[0.16] hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Search className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
              <span className="hidden sm:inline">Cari anime</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((p) => !p)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/[0.08] text-zinc-100 transition-colors hover:bg-white/[0.16] md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.nav
              id="mobile-nav-panel"
              aria-label="Navigasi mobile"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="border-t border-white/[0.06] bg-canvas px-4 py-3 md:hidden"
            >
              <ul className="space-y-1">
                {NAV_LINKS.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={`block rounded-md px-3 py-2.5 text-sm transition-colors ${
                          active ? 'bg-white/10 font-bold text-white' : 'font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
