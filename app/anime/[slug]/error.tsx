'use client';

import { ErrorState } from '@/components/ErrorState';

export default function PageError({ reset }: { reset: () => void }) {
  return <ErrorState message="Halaman belum bisa dimuat. Silakan coba lagi." onRetry={reset} />;
}
