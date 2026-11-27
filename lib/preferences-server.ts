import { cookies } from 'next/headers';
import { PREFERENCES_COOKIE, decodePreferences, type Preferences } from './preferences';

/** Dibaca di server supaya panel filter dan bagian 18+ tidak berkedip saat dimuat. */
export async function readPreferences(): Promise<Preferences> {
  const jar = await cookies();
  return decodePreferences(jar.get(PREFERENCES_COOKIE)?.value);
}
