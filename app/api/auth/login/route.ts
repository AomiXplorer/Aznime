import { clientIp, handleRouteError, isSameOrigin, jsonError, jsonResponse, readJsonBody } from '@/lib/auth/http';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { findUserByEmail, toPublicUser } from '@/lib/auth/users';
import { verifyPassword } from '@/lib/auth/crypto';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { verifyTurnstile, turnstileSiteKey } from '@/lib/auth/turnstile';
import { syncHistory } from '@/lib/auth/history';
import { normalizeEmail, validateEmail } from '@/lib/auth/validation';

export const dynamic = 'force-dynamic';

interface LoginBody {
  email?: unknown;
  password?: unknown;
  turnstileToken?: unknown;
  guestHistory?: unknown;
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const body = (await readJsonBody<LoginBody>(request)) || {};
    const ip = clientIp(request);
    const email = normalizeEmail(body.email);

    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit(`login:ip:${ip}`, 20, 600),
      consumeRateLimit(`login:email:${email || 'kosong'}`, 8, 600),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return jsonError(429, 'Terlalu banyak percobaan masuk. Tunggu 10 menit lalu coba lagi.', {
        retryAfter: Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds),
      });
    }

    const emailError = validateEmail(email);
    if (emailError) return jsonResponse({ error: emailError.message, errors: [emailError] }, 422);
    if (typeof body.password !== 'string' || body.password.length === 0) {
      return jsonError(422, 'Password wajib diisi.');
    }

    if (turnstileSiteKey()) {
      const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
      const result = await verifyTurnstile(token, { ip });
      if (!result.ok) {
        if (result.reason === 'misconfigured') {
          console.warn('[auth] TURNSTILE_SECRET_KEY ditolak Cloudflare; verifikasi dilewati sementara.');
        } else {
          const message =
            result.reason === 'expired'
              ? 'Verifikasi kedaluwarsa. Ulangi verifikasi lalu coba lagi.'
              : 'Verifikasi keamanan gagal. Ulangi verifikasi lalu coba lagi.';
          return jsonResponse({ error: message, code: `turnstile_${result.reason}` }, 400);
        }
      }
    }

    const user = await findUserByEmail(email);
    // Pesan sengaja sama untuk email tidak dikenal dan password salah.
    const invalid = () => jsonError(401, 'Email atau password salah.');
    if (!user || !user.passwordHash) {
      // Tetap jalankan scrypt sekali supaya waktu respons tidak membocorkan
      // apakah email terdaftar atau tidak.
      verifyPassword(String(body.password), 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
      return invalid();
    }
    if (!verifyPassword(String(body.password), user.passwordHash)) return invalid();

    const session = await createSession(user.id, { ip, userAgent: request.headers.get('user-agent') });
    await setSessionCookie(session.token);

    let synced = false;
    if (Array.isArray(body.guestHistory) && body.guestHistory.length > 0) {
      await syncHistory(user.id, body.guestHistory);
      synced = true;
    }

    return jsonResponse({ user: toPublicUser(user), synced });
  } catch (error) {
    return handleRouteError(error);
  }
}
