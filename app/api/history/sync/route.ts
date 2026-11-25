import { handleRouteError, isSameOrigin, jsonError, jsonResponse, readJsonBody } from '@/lib/auth/http';
import { rateLimitGuard } from '@/lib/api-guard';
import { getSessionUser } from '@/lib/auth/session';
import { syncHistory } from '@/lib/auth/history';

/** Batas entri history tamu yang boleh disinkronkan sekali jalan. */
const MAX_GUEST_HISTORY_ITEMS = 200;

export const dynamic = 'force-dynamic';

/**
 * Migrasi history tamu dari localStorage ke akun. Server menggabungkan dengan
 * history akun yang sudah ada; localStorage baru boleh dibersihkan setelah
 * balasan ini menyatakan synced: true.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    /* Sinkron menulis sampai 200 entri sekaligus; batas ketat menjaga agar
       rute ini tidak bisa dipakai membanjiri Redis lewat satu akun. */
    const limited = await rateLimitGuard(request, { name: 'history-sync', limit: 20, windowSeconds: 60 });
    if (limited) return limited;
    const user = await getSessionUser();
    if (!user) return jsonError(401, 'Masuk dulu untuk menyinkronkan history.');
    const body = await readJsonBody<{ items?: unknown }>(request);
    /* Array dari klien dibatasi: tanpa batas, satu permintaan bisa memaksa
       server memvalidasi dan menulis ratusan ribu entri sekaligus. */
    const items = Array.isArray(body?.items) ? body.items.slice(0, MAX_GUEST_HISTORY_ITEMS) : [];
    const result = await syncHistory(user.id, items);
    return jsonResponse(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
