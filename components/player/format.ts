export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 754 -> "12:34", 3754 -> "1:02:34". */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Versi yang enak dibacakan pembaca layar: "12 menit 34 detik". */
export function spokenClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 detik';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} jam`);
  if (m) parts.push(`${m} menit`);
  if (s || parts.length === 0) parts.push(`${s} detik`);
  return parts.join(' ');
}

/** Baca/tulis localStorage tanpa pernah melempar (mode privat, storage diblokir). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* diabaikan */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* diabaikan */
    }
  },
};
