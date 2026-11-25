import { handleRouteError, isSameOrigin, jsonError, jsonResponse, readJsonBody } from '@/lib/auth/http';
import { rateLimitGuard } from '@/lib/api-guard';
import { getSessionUser } from '@/lib/auth/session';
import { addFavorite, listFavorites, removeFavorite, sanitizeFavoriteInput } from '@/lib/auth/favorites';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const limited = await rateLimitGuard(request, { name: 'favorites', limit: 120, windowSeconds: 60 });
    if (limited) return limited;

    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk melihat daftar favorit.');
    const items = await listFavorites(user.id);
    return jsonResponse({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const limited = await rateLimitGuard(request, { name: 'favorites', limit: 120, windowSeconds: 60 });
    if (limited) return limited;
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk menyimpan favorit.');
    const body = await readJsonBody(request);
    const item = sanitizeFavoriteInput(body);
    if (!item) return jsonError(422, 'Data favorit tidak lengkap.');
    const saved = await addFavorite(user.id, item);
    return jsonResponse({ item: saved }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const limited = await rateLimitGuard(request, { name: 'favorites', limit: 120, windowSeconds: 60 });
    if (limited) return limited;
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk mengubah favorit.');
    const url = new URL(request.url);
    let animeId = url.searchParams.get('animeId') || '';
    if (!animeId) {
      const body = await readJsonBody<{ animeId?: unknown }>(request);
      animeId = typeof body?.animeId === 'string' ? body.animeId : '';
    }
    if (!animeId) return jsonError(422, 'animeId wajib diisi.');
    await removeFavorite(user.id, animeId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
