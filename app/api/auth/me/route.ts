import { usesPostgres } from '@/lib/db/config';
import { pgAccountCounts } from '@/lib/db/library';
import { jsonResponse, handleRouteError } from '@/lib/auth/http';
import { rateLimitGuard } from '@/lib/api-guard';
import { getSessionUser } from '@/lib/auth/session';
import { zCard } from '@/lib/auth/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    /* Dipanggil setiap halaman dimuat, jadi batasnya longgar: cukup untuk
       menghentikan pengulangan otomatis, tidak mengganggu pengunjung biasa. */
    const limited = await rateLimitGuard(request, { name: 'auth-me', limit: 120, windowSeconds: 60 });
    if (limited) return limited;

    const user = await getSessionUser();
    if (!user) return jsonResponse({ user: null, stats: { history: 0, favorites: 0 } });
    if (usesPostgres()) {
      const stats = await pgAccountCounts(user.id).catch(() => ({ history: 0, favorites: 0 }));
      return jsonResponse({ user, stats });
    }
    const [history, favorites] = await Promise.all([
      zCard(`user:${user.id}:history`).catch(() => 0),
      zCard(`user:${user.id}:favorites`).catch(() => 0),
    ]);
    return jsonResponse({ user, stats: { history, favorites } });
  } catch (error) {
    return handleRouteError(error);
  }
}
