'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthDialog, type AuthMode } from './AuthDialog';
import { clearGuestHistory, readGuestHistory } from '@/lib/guest-history';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  provider: 'email' | 'google' | 'discord';
  createdAt: string;
}

export interface AuthStats {
  history: number;
  favorites: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  stats: AuthStats;
  loading: boolean;
  openAuth: (mode?: AuthMode, returnTo?: string) => void;
  closeAuth: () => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<AuthStats>({ history: 0, favorites: 0 });
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ mode: AuthMode; returnTo?: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) {
        setUser(null);
        setStats({ history: 0, favorites: 0 });
        return;
      }
      const data = (await response.json()) as { user: AuthUser | null; stats?: AuthStats };
      setUser(data.user);
      setStats(data.stats || { history: 0, favorites: 0 });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // History tamu yang masih tertinggal (misalnya login lewat OAuth) dikirim
  // sekali setelah sesi aktif, lalu localStorage dibersihkan hanya jika
  // server menyatakan data sudah tersimpan.
  useEffect(() => {
    if (!user) return;
    const pending = readGuestHistory();
    if (pending.length === 0) return;
    let cancelled = false;
    void fetch('/api/history/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: pending }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { synced?: boolean };
        if (!cancelled && data.synced) clearGuestHistory();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const openAuth = useCallback((mode: AuthMode = 'login', returnTo?: string) => {
    setDialog({ mode, returnTo });
  }, []);

  const closeAuth = useCallback(() => setDialog(null), []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    setStats({ history: 0, favorites: 0 });
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, stats, loading, openAuth, closeAuth, refresh, logout }),
    [user, stats, loading, openAuth, closeAuth, refresh, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {dialog ? (
        <AuthDialog
          mode={dialog.mode}
          returnTo={dialog.returnTo}
          onClose={closeAuth}
          onAuthenticated={async () => {
            await refresh();
            router.refresh();
          }}
        />
      ) : null}
    </AuthContext.Provider>
  );
}
