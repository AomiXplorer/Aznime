import { jsonResponse, handleRouteError } from '@/lib/auth/http';
import { rateLimitGuard } from '@/lib/api-guard';
import { isRedisConfigured } from '@/lib/auth/redis';
import { isTurnstileConfigured, turnstileSiteKey } from '@/lib/auth/turnstile';
import { oauthConfig } from '@/lib/auth/oauth';

export const dynamic = 'force-dynamic';

/** Konfigurasi publik untuk modal login. Tidak pernah memuat secret. */
export async function GET(request: Request) {
  try {
    const limited = await rateLimitGuard(request, { name: 'auth-config', limit: 60, windowSeconds: 60 });
    if (limited) return limited;

    const siteKey = turnstileSiteKey();
    return jsonResponse({
      turnstileSiteKey: siteKey || null,
      turnstile: isTurnstileConfigured() ? 'active' : siteKey ? 'incomplete' : 'disabled',
      providers: {
        google: Boolean(oauthConfig('google')),
        discord: Boolean(oauthConfig('discord')),
      },
      redis: isRedisConfigured(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
