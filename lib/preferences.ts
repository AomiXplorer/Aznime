export interface Preferences {
  /** Tampilkan Hentai dan Manhwa 18+ di katalog serta buka bagiannya. */
  adult: boolean;
  /** Catat episode yang dibuka ke Riwayat (akun maupun tamu). */
  saveHistory: boolean;
  /** Matikan transisi dan animasi geser. */
  reduceMotion: boolean;
}

export const PREFERENCES_COOKIE = 'aznime_prefs';
export const PREFERENCES_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_PREFERENCES: Preferences = {
  adult: false,
  saveHistory: true,
  reduceMotion: false,
};

const ADULT_TOKEN = 'adult';
const NO_HISTORY_TOKEN = 'nohistory';
const NO_MOTION_TOKEN = 'nomotion';

/**
 * Cookie hanya menyimpan nilai yang menyimpang dari bawaan, jadi pengunjung
 * yang tidak pernah membuka Pengaturan tidak membawa cookie apa pun.
 */
export function encodePreferences(prefs: Preferences): string {
  const tokens: string[] = [];
  if (prefs.adult) tokens.push(ADULT_TOKEN);
  if (!prefs.saveHistory) tokens.push(NO_HISTORY_TOKEN);
  if (prefs.reduceMotion) tokens.push(NO_MOTION_TOKEN);
  return tokens.join('.');
}

export function decodePreferences(raw: string | null | undefined): Preferences {
  const tokens = new Set(
    (raw || '')
      .toLowerCase()
      .split(/[.\s,|]+/)
      .filter(Boolean)
  );
  return {
    adult: tokens.has(ADULT_TOKEN),
    saveHistory: !tokens.has(NO_HISTORY_TOKEN),
    reduceMotion: tokens.has(NO_MOTION_TOKEN),
  };
}

export function preferencesCookie(prefs: Preferences, secure = false): string {
  const value = encodePreferences(prefs);
  return `${PREFERENCES_COOKIE}=${value}; path=/; max-age=${PREFERENCES_MAX_AGE}; samesite=lax${secure ? '; secure' : ''}`;
}

export function loadPreferences(): Preferences {
  if (typeof document === 'undefined') return DEFAULT_PREFERENCES;
  const match = document.cookie.match(new RegExp(`(?:^|; )${PREFERENCES_COOKIE}=([^;]*)`));
  return decodePreferences(match ? decodeURIComponent(match[1]) : '');
}

export function savePreferences(prefs: Preferences): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:';
  document.cookie = preferencesCookie(prefs, secure);
}
