'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, Eye, LogOut, RotateCcw, Trash2, UserRound, Wand2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { DEFAULT_PREFERENCES, savePreferences, type Preferences } from '@/lib/preferences';
import { DeleteAccountDialog } from './DeleteAccountDialog';

const PROVIDER_LABEL: Record<string, string> = {
  email: 'Email & password',
  google: 'Google',
  discord: 'Discord',
};

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        checked ? 'border-accent bg-accent-strong' : 'border-line bg-white/[0.07]'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block h-[15px] w-[15px] rounded-full bg-white transition-transform duration-150',
          checked ? 'translate-x-[23px]' : 'translate-x-[4px]'
        )}
      />
    </button>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{description}</p>
        ) : null}
      </div>
      <div className="divide-y divide-line-soft">{children}</div>
    </section>
  );
}

function Row({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-4">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 text-zinc-500">{icon}</span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-snug text-zinc-100">{title}</p>
          <p className="mt-1 max-w-[52ch] text-[12px] leading-relaxed text-zinc-500">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

export function SettingsView({ initial }: { initial: Preferences }) {
  const router = useRouter();
  const { user, refresh, logout } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
  }, []);

  const reset = () => {
    setPrefs(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  };

  const changed =
    prefs.adult !== DEFAULT_PREFERENCES.adult ||
    prefs.saveHistory !== DEFAULT_PREFERENCES.saveHistory ||
    prefs.reduceMotion !== DEFAULT_PREFERENCES.reduceMotion;

  return (
    <div className="grid gap-4">
      <Section
        title="Konten"
        description="Pilihan ini disimpan di perangkat ini, jadi tidak ikut ke akun atau perangkat lain."
      >
        <Row
          icon={<Eye className="h-4 w-4" aria-hidden="true" />}
          title="Konten dewasa 18+"
          description="Menampilkan Hentai dan Manhwa 18+ di panel Tipe katalog. Saat mati, keduanya disembunyikan dan tautannya tidak bisa dibuka."
        >
          <Toggle
            checked={prefs.adult}
            label="Tampilkan konten dewasa 18+"
            onChange={(next) => update('adult', next)}
          />
        </Row>
      </Section>

      <Section title="Tontonan">
        <Row
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          title="Simpan riwayat otomatis"
          description="Setiap episode yang kamu buka dicatat di Riwayat. Matikan kalau tidak ingin jejak tontonan tersimpan."
        >
          <Toggle
            checked={prefs.saveHistory}
            label="Simpan riwayat tontonan"
            onChange={(next) => update('saveHistory', next)}
          />
        </Row>
      </Section>

      <Section title="Tampilan">
        <Row
          icon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
          title="Kurangi animasi"
          description="Mematikan transisi dan animasi geser, misalnya saat membuka menu atau panel filter. Berguna di perangkat yang terasa berat."
        >
          <Toggle
            checked={prefs.reduceMotion}
            label="Kurangi animasi"
            onChange={(next) => update('reduceMotion', next)}
          />
        </Row>
      </Section>

      <Section title="Akun">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-elevated text-[15px] font-semibold text-zinc-300">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.username.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-white">{user.username}</p>
                <p className="truncate text-[12px] text-zinc-500">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {PROVIDER_LABEL[user.provider] || user.provider}
                </p>
              </div>
              <Link
                href="/profile"
                className="ml-auto shrink-0 text-[12px] font-semibold text-zinc-400 transition-colors hover:text-white"
              >
                Profil
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 px-4 py-4">
              <button
                type="button"
                onClick={() => {
                  setBusy(true);
                  void logout().finally(() => setBusy(false));
                }}
                disabled={busy}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[4px] border border-line px-3.5 text-[12.5px] font-medium text-zinc-200 transition-colors duration-150 hover:border-accent/60 hover:text-white disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Keluar
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[4px] border border-accent/30 px-3.5 text-[12.5px] font-medium text-accent-soft transition-colors duration-150 hover:border-accent hover:bg-accent/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Hapus akun
              </button>
            </div>
            <p className="px-4 py-3 text-[11.5px] leading-relaxed text-zinc-600">
              Menghapus akun juga menghapus riwayat tontonan dan daftar favorit yang tersimpan di
              server. Tindakan ini tidak bisa dibatalkan.
            </p>
          </>
        ) : (
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-zinc-500">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-zinc-100">Belum masuk</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                  Masuk untuk menyimpan riwayat, favorit, dan mengelola akun.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="mt-3 inline-flex h-9 cursor-pointer items-center rounded-[4px] bg-white px-3.5 text-[12.5px] font-semibold text-black transition-colors duration-150 hover:bg-white/85"
            >
              Masuk atau daftar
            </button>
          </div>
        )}
      </Section>

      {changed ? (
        <button
          type="button"
          onClick={reset}
          className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-[4px] px-1 py-1 text-[12px] font-semibold text-zinc-500 transition-colors hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Kembalikan ke bawaan
        </button>
      ) : null}

      {user ? (
        <DeleteAccountDialog
          open={deleteOpen}
          username={user.username}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            void refresh().then(() => {
              router.replace('/');
              router.refresh();
            });
          }}
        />
      ) : null}
    </div>
  );
}
