import { jsonResponse, handleRouteError } from '@/lib/auth/http';
import { getSessionUser } from '@/lib/auth/session';
import { zCard } from '@/lib/auth/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return jsonResponse({ user: null, stats: { history: 0, favorites: 0 } });
    const [history, favorites] = await Promise.all([
      zCard(`user:${user.id}:history`).catch(() => 0),
      zCard(`user:${user.id}:favorites`).catch(() => 0),
    ]);
    return jsonResponse({ user, stats: { history, favorites } });
  } catch (error) {
    return handleRouteError(error);
  }
}
