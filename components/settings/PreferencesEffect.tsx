'use client';

import { useEffect } from 'react';
import { loadPreferences } from '@/lib/preferences';

/**
 * Menempelkan pilihan tampilan ke elemen <html> setelah hidrasi. Tanpa ini,
 * "kurangi animasi" hanya berlaku di halaman Pengaturan.
 */
export function PreferencesEffect() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.reduceMotion = loadPreferences().reduceMotion
        ? 'true'
        : 'false';
    };
    apply();
    window.addEventListener('focus', apply);
    return () => window.removeEventListener('focus', apply);
  }, []);

  return null;
}
