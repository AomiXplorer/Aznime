import { handleRouteError, isSameOrigin, jsonError, jsonResponse, readJsonBody } from '@/lib/auth/http';
import { rateLimitGuard } from '@/lib/api-guard';
import { getSessionUser } from '@/lib/auth/session';
import { listHistory, removeHistory, sanitizeHistoryItem, upsertHistory } from '@/lib/auth/history';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const limited = await rateLimitGuard(request, { name: 'history', limit: 120, windowSeconds: 60 });
    if (limited) return limited;

    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk melihat history akun.');
    const items = await listHistory(user.id);
    return jsonResponse({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const limited = await rateLimitGuard(request, { name: 'history', limit: 120, windowSeconds: 60 });
    if (limited) return limited;
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk menyimpan history.');
    const body = await readJsonBody(request);
    const item = sanitizeHistoryItem(body);
    if (!item) return jsonError(422, 'Data history tidak lengkap.');
    // userId selalu dari session, bukan dari body, jadi tidak bisa menulis ke akun lain.
    const saved = await upsertHistory(user.id, item);
    return jsonResponse({ item: saved });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const limited = await rateLimitGuard(request, { name: 'history', limit: 120, windowSeconds: 60 });
    if (limited) return limited;
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk menghapus history.');
    const url = new URL(request.url);
    let animeId = url.searchParams.get('animeId') || '';
    if (!animeId) {
      const body = await readJsonBody<{ animeId?: unknown }>(request);
      animeId = typeof body?.animeId === 'string' ? body.animeId : '';
    }
    if (!animeId) return jsonError(422, 'animeId wajib diisi.');
    await removeHistory(user.id, animeId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
