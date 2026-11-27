import { handleRouteError, isSameOrigin, jsonError, jsonResponse } from '@/lib/auth/http';
import { rateLimitGuard } from '@/lib/api-guard';
import { clearSessionCookie, getSessionUser } from '@/lib/auth/session';
import { deleteAccount } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const limited = await rateLimitGuard(request, { name: 'account-delete', limit: 5, windowSeconds: 60 });
    if (limited) return limited;

    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk menghapus akun.');

    await deleteAccount(user.id);
    await clearSessionCookie();
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
