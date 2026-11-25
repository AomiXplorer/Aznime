import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { rateLimitGuard } from '@/lib/api-guard';
import {
  consumeOAuthState,
  exchangeCodeForProfile,
  isOAuthProvider,
  normalizeOAuthReturnTo,
  oauthConfig,
  oauthStateCookieName,
} from '@/lib/auth/oauth';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { EmailTakenError, createUser, findUserByEmail, findUserByOAuth, toPublicUser, updateUser } from '@/lib/auth/users';
import { normalizeEmail, usernameFromEmail } from '@/lib/auth/validation';

export const dynamic = 'force-dynamic';

function redirectWithError(request: Request, code: string, provider?: 'google' | 'discord'): NextResponse {
  const response = NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(code)}`, request.url));
  if (provider) {
    response.cookies.set(oauthStateCookieName(provider), '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(request.url).protocol === 'https:' || (process.env.AUTH_URL || '').startsWith('https://'),
      path: `/api/auth/oauth/${provider}/callback`,
      maxAge: 0,
    });
  }
  return response;
}

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const limited = await rateLimitGuard(request, { name: 'oauth-callback', limit: 30, windowSeconds: 60 });
  if (limited) return limited;

  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !oauthConfig(provider)) return redirectWithError(request, 'provider_unavailable');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  if (url.searchParams.get('error')) return redirectWithError(request, 'access_denied', provider);
  if (!code) return redirectWithError(request, 'missing_code', provider);

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(oauthStateCookieName(provider))?.value;
  if (!stateParam || stateCookie !== stateParam) return redirectWithError(request, 'invalid_state', provider);

  const state = await consumeOAuthState(stateParam);
  if (!state) return redirectWithError(request, 'invalid_state', provider);

  const profile = await exchangeCodeForProfile(provider, code, request.url);
  if (!profile) return redirectWithError(request, 'profile_unavailable', provider);

  let user = await findUserByOAuth(provider, profile.providerId);

  if (!user) {
    const email = normalizeEmail(profile.email);
    const existing = email ? await findUserByEmail(email) : null;
    // Akun dengan email yang sama tidak digabung otomatis: pemilik akun harus
    // masuk lewat metode aslinya dulu. Ini keputusan keamanan, bukan bug.
    if (existing) return redirectWithError(request, 'email_exists', provider);
    try {
      user = await createUser({
        email,
        username: usernameFromEmail(email || profile.name),
        provider,
        providerId: profile.providerId,
        avatar: profile.avatar,
      });
    } catch (error) {
      if (error instanceof EmailTakenError) return redirectWithError(request, 'email_exists', provider);
      return redirectWithError(request, 'server_error', provider);
    }
  } else if (profile.avatar && !user.avatar) {
    await updateUser(user.id, { avatar: profile.avatar });
  }

  const session = await createSession(user.id, {
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });
  await setSessionCookie(session.token);

  const target = normalizeOAuthReturnTo(state.returnTo, request.url);
  const redirectUrl = new URL(target, request.url);
  redirectUrl.searchParams.set('auth', 'ok');
  void toPublicUser(user);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(oauthStateCookieName(provider), '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:' || (process.env.AUTH_URL || '').startsWith('https://'),
    path: `/api/auth/oauth/${provider}/callback`,
    maxAge: 0,
  });
  return response;
}
