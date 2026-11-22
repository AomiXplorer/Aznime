import { NextResponse } from 'next/server';
import { consumeOAuthState, exchangeCodeForProfile, isOAuthProvider, oauthConfig } from '@/lib/auth/oauth';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { EmailTakenError, createUser, findUserByEmail, findUserByOAuth, toPublicUser, updateUser } from '@/lib/auth/users';
import { normalizeEmail, usernameFromEmail } from '@/lib/auth/validation';

export const dynamic = 'force-dynamic';

function redirectWithError(request: Request, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(code)}`, request.url));
}

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !oauthConfig(provider)) return redirectWithError(request, 'provider_unavailable');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  if (url.searchParams.get('error')) return redirectWithError(request, 'access_denied');
  if (!code) return redirectWithError(request, 'missing_code');

  const state = await consumeOAuthState(stateParam);
  if (!state) return redirectWithError(request, 'invalid_state');

  const profile = await exchangeCodeForProfile(provider, code, request.url);
  if (!profile) return redirectWithError(request, 'profile_unavailable');

  let user = await findUserByOAuth(provider, profile.providerId);

  if (!user) {
    const email = normalizeEmail(profile.email);
    const existing = email ? await findUserByEmail(email) : null;
    // Akun dengan email yang sama tidak digabung otomatis: pemilik akun harus
    // masuk lewat metode aslinya dulu. Ini keputusan keamanan, bukan bug.
    if (existing) return redirectWithError(request, 'email_exists');
    try {
      user = await createUser({
        email,
        username: usernameFromEmail(email || profile.name),
        provider,
        providerId: profile.providerId,
        avatar: profile.avatar,
      });
    } catch (error) {
      if (error instanceof EmailTakenError) return redirectWithError(request, 'email_exists');
      return redirectWithError(request, 'server_error');
    }
  } else if (profile.avatar && !user.avatar) {
    await updateUser(user.id, { avatar: profile.avatar });
  }

  const session = await createSession(user.id, {
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });
  await setSessionCookie(session.token);

  const target = state.returnTo && state.returnTo.startsWith('/') ? state.returnTo : '/';
  const redirectUrl = new URL(target, request.url);
  redirectUrl.searchParams.set('auth', 'ok');
  void toPublicUser(user);
  return NextResponse.redirect(redirectUrl);
}
