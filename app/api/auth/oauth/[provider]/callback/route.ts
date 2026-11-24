import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { consumeOAuthState, exchangeCodeForProfile, isOAuthProvider, oauthConfig } from '@/lib/auth/oauth';
=======
import { cookies } from 'next/headers';
import {
  consumeOAuthState,
  exchangeCodeForProfile,
  isOAuthProvider,
  normalizeOAuthReturnTo,
  oauthConfig,
  oauthStateCookieName,
} from '@/lib/auth/oauth';
>>>>>>> c5dfbd0 (Update maintennace)
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { EmailTakenError, createUser, findUserByEmail, findUserByOAuth, toPublicUser, updateUser } from '@/lib/auth/users';
import { normalizeEmail, usernameFromEmail } from '@/lib/auth/validation';

export const dynamic = 'force-dynamic';

<<<<<<< HEAD
function redirectWithError(request: Request, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(code)}`, request.url));
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
}

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !oauthConfig(provider)) return redirectWithError(request, 'provider_unavailable');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
<<<<<<< HEAD
  if (url.searchParams.get('error')) return redirectWithError(request, 'access_denied');
  if (!code) return redirectWithError(request, 'missing_code');

  const state = await consumeOAuthState(stateParam);
  if (!state) return redirectWithError(request, 'invalid_state');

  const profile = await exchangeCodeForProfile(provider, code, request.url);
  if (!profile) return redirectWithError(request, 'profile_unavailable');
=======
  if (url.searchParams.get('error')) return redirectWithError(request, 'access_denied', provider);
  if (!code) return redirectWithError(request, 'missing_code', provider);

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(oauthStateCookieName(provider))?.value;
  if (!stateParam || stateCookie !== stateParam) return redirectWithError(request, 'invalid_state', provider);

  const state = await consumeOAuthState(stateParam);
  if (!state) return redirectWithError(request, 'invalid_state', provider);

  const profile = await exchangeCodeForProfile(provider, code, request.url);
  if (!profile) return redirectWithError(request, 'profile_unavailable', provider);
>>>>>>> c5dfbd0 (Update maintennace)

  let user = await findUserByOAuth(provider, profile.providerId);

  if (!user) {
    const email = normalizeEmail(profile.email);
    const existing = email ? await findUserByEmail(email) : null;
    // Akun dengan email yang sama tidak digabung otomatis: pemilik akun harus
    // masuk lewat metode aslinya dulu. Ini keputusan keamanan, bukan bug.
<<<<<<< HEAD
    if (existing) return redirectWithError(request, 'email_exists');
=======
    if (existing) return redirectWithError(request, 'email_exists', provider);
>>>>>>> c5dfbd0 (Update maintennace)
    try {
      user = await createUser({
        email,
        username: usernameFromEmail(email || profile.name),
        provider,
        providerId: profile.providerId,
        avatar: profile.avatar,
      });
    } catch (error) {
<<<<<<< HEAD
      if (error instanceof EmailTakenError) return redirectWithError(request, 'email_exists');
      return redirectWithError(request, 'server_error');
=======
      if (error instanceof EmailTakenError) return redirectWithError(request, 'email_exists', provider);
      return redirectWithError(request, 'server_error', provider);
>>>>>>> c5dfbd0 (Update maintennace)
    }
  } else if (profile.avatar && !user.avatar) {
    await updateUser(user.id, { avatar: profile.avatar });
  }

  const session = await createSession(user.id, {
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });
  await setSessionCookie(session.token);

<<<<<<< HEAD
  const target = state.returnTo && state.returnTo.startsWith('/') ? state.returnTo : '/';
  const redirectUrl = new URL(target, request.url);
  redirectUrl.searchParams.set('auth', 'ok');
  void toPublicUser(user);
  return NextResponse.redirect(redirectUrl);
=======
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
>>>>>>> c5dfbd0 (Update maintennace)
}
