import { handleRouteError, isSameOrigin, jsonError, jsonResponse } from '@/lib/auth/http';
import { rateLimitGuard } from '@/lib/api-guard';
import { clearSessionCookie, destroySession, readSessionToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const limited = await rateLimitGuard(request, { name: 'logout', limit: 30, windowSeconds: 60 });
    if (limited) return limited;
    const token = await readSessionToken();
    if (token) await destroySession(token).catch(() => undefined);
    await clearSessionCookie();
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
