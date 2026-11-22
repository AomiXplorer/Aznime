import { handleRouteError, isSameOrigin, jsonError, jsonResponse, readJsonBody } from '@/lib/auth/http';
import { getSessionUser } from '@/lib/auth/session';
import { syncHistory } from '@/lib/auth/history';

export const dynamic = 'force-dynamic';

/**
 * Migrasi history tamu dari localStorage ke akun. Server menggabungkan dengan
 * history akun yang sudah ada; localStorage baru boleh dibersihkan setelah
 * balasan ini menyatakan synced: true.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk menyinkronkan history.');
    const body = await readJsonBody<{ items?: unknown }>(request);
    const items = Array.isArray(body?.items) ? body.items : [];
    const result = await syncHistory(user.id, items);
    return jsonResponse(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
