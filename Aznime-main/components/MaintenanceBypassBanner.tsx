'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { BYPASS_HINT_COOKIE_NAME } from '@/lib/maintenance-constants';

export function MaintenanceBypassBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasHint = document.cookie
      .split(';')
      .some((part) => part.trim().startsWith(`${BYPASS_HINT_COOKIE_NAME}=1`));
    if (!hasHint) return;

    let cancelled = false;
    fetch('/api/maintenance/status', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean; bypassActive?: boolean } | null) => {
        if (!cancelled && data?.enabled && data?.bypassActive) {
          setVisible(true);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <aside
      aria-label="Indikator bypass mode maintenance"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-rose-500/35 bg-surface/95 px-3.5 py-2.5 text-[12px] text-zinc-200 shadow-lg"
    >
      <ShieldCheck className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
      <span className="whitespace-nowrap font-medium">Bypass Admin · Maintenance 503 Aktif</span>
      <a
        href="/api/maintenance/bypass?exit=1"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-white/10 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Keluar
      </a>
    </aside>
  );
}
