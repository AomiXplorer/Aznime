'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Menu, Search, Settings, X } from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { Wordmark } from './Wordmark';
import { useAuth } from './auth/AuthProvider';

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
  { href: '/film', label: 'Film' },
  { href: '/komik', label: 'Komik' },
  { href: '/webtoon', label: 'Webtoon' },
] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, loading: authLoading, openAuth } = useAuth();
  // Di bagian dewasa, tombol cari ikut mencari katalog Nekopoi.
  const adult = pathname === '/hentai' || pathname.startsWith('/hentai/');
  const watchPage = pathname === '/watch' || pathname.startsWith('/watch/');
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
    const desktop = window.matchMedia('(min-width: 64rem)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      window.removeEventListener('keydown', onKeyDown);
    };
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
      <header className={`${watchPage ? 'relative' : 'sticky top-0'} z-40 isolate`}>
        {/* Latar solid tanpa backdrop-filter: blur pada elemen sticky memaksa
            browser me-render ulang seluruh area di belakangnya setiap frame
            saat scroll, dan itu penyebab utama scroll tersendat di Android.
            Harus 100% buram (bukan /95): sisa 5% meloloskan poster yang lewat
            di bawah header, dan di pita terang "Dari arsip" krem ikut
            mengangkat warna header menjadi lebih terang dari seharusnya. */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 border-b border-[#241d1d] bg-canvas transition-opacity duration-300 ${
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

          {/* Tautan utama baru muat mulai 1024 px. Di 768 px logo, enam tautan,
              tombol masuk, pencarian, dan menu berjumlah 867 px, sehingga
              halaman melebar 99 px ke samping; panel menu yang sudah ada
              menggantikannya di tablet. */}
          <nav aria-label="Navigasi utama" className="hidden flex-1 items-center gap-5 lg:flex lg:gap-6">
            {user
              ? [
                  { href: '/history', label: 'Riwayat' },
                  { href: '/favorites', label: 'Favorit' },
                ].map((link) => {
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
                })
              : null}
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
            {authLoading ? (
              <span
                aria-hidden="true"
                className="h-12 w-12 animate-pulse rounded-[4px] border border-white/10 bg-white/[0.03] sm:h-9 sm:w-9"
              />
            ) : user ? (
              <Link
                href="/profile"
                aria-label={`Akun ${user.username}`}
                className="inline-flex h-12 items-center gap-2 rounded-[4px] border border-white/10 bg-white/[0.03] px-2 text-[12.5px] sm:h-9 font-medium text-zinc-200 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-[10px] font-semibold text-zinc-200">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.username.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="hidden max-w-[92px] truncate sm:inline">{user.username}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('login', pathname)}
                className="inline-flex h-12 cursor-pointer items-center rounded-[4px] bg-white/[0.08] px-3 text-[12.5px] sm:h-9 font-semibold text-white transition-colors duration-150 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Masuk
              </button>
            )}

            {/* Di layar lebar panel menu tidak ada, jadi gerigi pengaturan
                ikut berdiri di sebelah akun seperti di dalam laci menu. */}
            <Link
              href="/settings"
              prefetch={false}
              aria-label="Pengaturan"
              title="Pengaturan"
              className="hidden h-9 w-9 items-center justify-center rounded-[4px] border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:inline-flex"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setSearchMounted(true);
                setSearchOpen(true);
              }}
              aria-label={adult ? 'Buka pencarian hentai' : 'Buka pencarian anime'}
              className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[4px] border border-white/10 bg-white/[0.03] px-3 text-[12.5px] text-zinc-300 sm:h-9 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
              className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[4px] border border-white/10 px-2.5 text-zinc-200 sm:h-9 lg:hidden transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
              <span className="hidden text-[12.5px] font-medium sm:inline">Menu</span>
            </button>
          </div>
        </div>

      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
        user={user}
        authLoading={authLoading}
        onLogin={() => openAuth('login', pathname)}
      />

      {searchMounted ? (
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} adult={adult} />
      ) : null}
    </>
  );
}
