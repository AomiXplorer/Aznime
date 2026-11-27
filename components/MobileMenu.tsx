'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Settings, X } from 'lucide-react';
import type { AuthUser } from './auth/AuthProvider';
import { Wordmark } from './Wordmark';

interface MenuLink {
  href: string;
  label: string;
}

const BROWSE_LINKS: MenuLink[] = [
  { href: '/', label: 'Beranda' },
  { href: '/anime', label: 'Katalog' },
  { href: '/ongoing', label: 'Ongoing' },
  { href: '/completed', label: 'Completed' },
  { href: '/schedule', label: 'Jadwal' },
  { href: '/komik', label: 'Komik' },
  { href: '/donghive', label: 'DongHive' },
  { href: '/webtoon', label: 'Webtoon' },
];

const ACCOUNT_LINKS: MenuLink[] = [
  { href: '/history', label: 'Riwayat tontonan' },
  { href: '/favorites', label: 'Favorit' },
  { href: '/profile', label: 'Profil' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1.5 pt-5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-zinc-500">
      {children}
    </p>
  );
}

function Row({
  href,
  label,
  active,
  onNavigate,
}: MenuLink & { active: boolean; onNavigate: () => void }) {
  return (
    <li>
      <Link
        href={href}
        prefetch={false}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`relative flex h-12 items-center justify-between border-b border-line-soft/60 pl-4 pr-4 text-[15px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-inset ${
          active ? 'font-semibold text-white' : 'font-medium text-zinc-300 hover:text-white'
        }`}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-accent"
          />
        ) : null}
        {label}
      </Link>
    </li>
  );
}

export function MobileMenu({
  open,
  onClose,
  pathname,
  user,
  authLoading,
  onLogin,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  user: AuthUser | null;
  authLoading: boolean;
  onLogin: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Keep the body out of the scroll chain so the sticky navbar stays put.
    const root = document.documentElement;
    const previousOverflow = root.style.overflowY;
    const opener = document.activeElement;
    root.style.overflowY = 'hidden';
    closeRef.current?.focus({ preventScroll: true });

    return () => {
      root.style.overflowY = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open]);

  // Fokus tetap di dalam laci selama terbuka.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  /* Panel ini harus tampil di semua lebar tempat tautan utama disembunyikan,
     yaitu di bawah 1024 px. Kalau tetap md:hidden, tombol Menu di tablet
     tidak membuka apa pun. */
  return (
    <div className="fixed inset-0 z-50 overflow-clip lg:hidden">
      <button
        type="button"
        aria-label="Tutup menu"
        onClick={onClose}
        className="drawer-backdrop absolute inset-0 h-full w-full cursor-default bg-black/70"
      />

      <div
        ref={panelRef}
        id="mobile-nav-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        className="drawer-panel absolute right-0 top-0 flex h-[100dvh] w-[min(86vw,340px)] flex-col border-l border-line-soft bg-canvas"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line-soft pl-5 pr-3">
          <span className="text-[1.35rem]">
            <Wordmark />
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="-mr-1 flex h-12 w-12 cursor-pointer items-center justify-center rounded-[4px] text-zinc-400 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
          <nav aria-label="Navigasi utama">
            <SectionLabel>Jelajahi</SectionLabel>
            <ul>
              {BROWSE_LINKS.map((link) => (
                <Row
                  key={link.href}
                  {...link}
                  active={isActive(pathname, link.href)}
                  onNavigate={onClose}
                />
              ))}
            </ul>
          </nav>

          <nav aria-label="Akun">
            <SectionLabel>Akun</SectionLabel>
            <ul>
              {user
                ? ACCOUNT_LINKS.map((link) => (
                    <Row
                      key={link.href}
                      {...link}
                      active={isActive(pathname, link.href)}
                      onNavigate={onClose}
                    />
                  ))
                : null}
              <Row
                href="/credit"
                label="Credits"
                active={isActive(pathname, '/credit')}
                onNavigate={onClose}
              />
            </ul>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-line-soft p-4">
          <div className="min-w-0 flex-1">
            {authLoading ? (
              <div aria-hidden="true" className="h-12 w-full animate-pulse rounded-[4px] bg-white/[0.04]" />
            ) : user ? (
              <Link
                href="/profile"
                prefetch={false}
                onClick={onClose}
                className="flex items-center gap-3 rounded-[4px] px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-[12px] font-semibold text-zinc-200">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.username.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-white">
                    {user.username}
                  </span>
                  <span className="block truncate text-[12px] text-zinc-500">{user.email}</span>
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogin();
                }}
                className="h-12 w-full cursor-pointer rounded-[4px] bg-white text-[13.5px] font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Masuk atau daftar
              </button>
            )}
          </div>

          {/* Gerigi pengaturan berdampingan dengan akun, dan tetap ada walau
              belum masuk karena filter konten berlaku untuk semua orang. */}
          <Link
            href="/settings"
            prefetch={false}
            onClick={onClose}
            aria-label="Pengaturan"
            title="Pengaturan"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] border border-line text-zinc-400 transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
