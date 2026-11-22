'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { recordGuestHistory } from '@/lib/guest-history';
import type { HistoryItem } from '@/lib/auth/history';

export interface WatchRecorderProps {
  animeId: string;
  title: string;
  poster: string | null;
  episodeNumber: string | null;
  episodeSlug: string | null;
  episodeTitle: string | null;
  position?: number;
}

/**
 * Mencatat satu kunjungan episode. Satu tulisan per halaman, bukan per detik:
 * player saat ini memakai iframe pihak ketiga yang tidak mengirim progres.
 */
export function WatchRecorder(props: WatchRecorderProps) {
  const { user, loading } = useAuth();
  const { animeId, title, poster, episodeNumber, episodeSlug, episodeTitle, position = 0 } = props;

  useEffect(() => {
    if (loading || !animeId || !title) return;
    const item: HistoryItem = {
      animeId,
      title,
      poster,
      episodeNumber,
      episodeSlug,
      episodeTitle,
      updatedAt: Date.now(),
      position,
    };

    if (!user) {
      recordGuestHistory(item);
      return;
    }

    void fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }).catch(() => undefined);
  }, [loading, user, animeId, title, poster, episodeNumber, episodeSlug, episodeTitle, position]);

  return null;
}
