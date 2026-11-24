import { clientIp, handleRouteError, isSameOrigin, jsonError, jsonResponse, readJsonBody } from '@/lib/auth/http';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { EmailTakenError, createUser, toPublicUser } from '@/lib/auth/users';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { isTurnstileSecretUsable, verifyTurnstile, turnstileSiteKey } from '@/lib/auth/turnstile';
import { syncHistory } from '@/lib/auth/history';
import {
  normalizeEmail,
  usernameFromEmail,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
  type FieldError,
} from '@/lib/auth/validation';

<<<<<<< HEAD
=======
/** Batas entri history tamu yang boleh disinkronkan sekali jalan. */
const MAX_GUEST_HISTORY_ITEMS = 200;

>>>>>>> c5dfbd0 (Update maintennace)
export const dynamic = 'force-dynamic';

interface RegisterBody {
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  username?: unknown;
  turnstileToken?: unknown;
  guestHistory?: unknown;
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError(403, 'Permintaan ditolak.');
    const body = (await readJsonBody<RegisterBody>(request)) || {};
    const ip = clientIp(request);

    const limit = await consumeRateLimit(`register:ip:${ip}`, 5, 600);
    if (!limit.allowed) {
      return jsonError(429, 'Terlalu banyak percobaan mendaftar. Coba lagi dalam 10 menit.', {
        retryAfter: limit.retryAfterSeconds,
      });
    }

    const email = normalizeEmail(body.email);
    const usernameInput = typeof body.username === 'string' ? body.username.trim() : '';
    const errors = [
      validateEmail(email),
      validatePassword(body.password),
      validatePasswordConfirm(body.password, body.confirmPassword),
      validateUsername(usernameInput),
    ].filter((error): error is FieldError => error !== null);
    if (errors.length > 0) return jsonResponse({ error: errors[0].message, errors }, 422);

    if (turnstileSiteKey() && (await isTurnstileSecretUsable())) {
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

    const username = usernameInput || usernameFromEmail(email);

    let user;
    try {
      user = await createUser({ email, username, password: String(body.password) });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        return jsonError(409, 'Email sudah terdaftar. Masuk dengan email itu atau pakai email lain.');
      }
      throw error;
    }

    const session = await createSession(user.id, { ip, userAgent: request.headers.get('user-agent') });
    await setSessionCookie(session.token);

    let synced = false;
    if (Array.isArray(body.guestHistory) && body.guestHistory.length > 0) {
<<<<<<< HEAD
      await syncHistory(user.id, body.guestHistory);
=======
      await syncHistory(user.id, body.guestHistory.slice(0, MAX_GUEST_HISTORY_ITEMS));
>>>>>>> c5dfbd0 (Update maintennace)
      synced = true;
    }

    return jsonResponse({ user: toPublicUser(user), synced }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
