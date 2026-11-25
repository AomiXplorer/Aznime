import { NextResponse } from 'next/server';
import { rateLimitGuard } from '@/lib/api-guard';
import {
  buildAuthorizeUrl,
  createOAuthState,
  isOAuthProvider,
  normalizeOAuthReturnTo,
  oauthConfig,
  oauthStateCookieName,
} from '@/lib/auth/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  /* Setiap permintaan menulis satu kunci state ke Redis. Tanpa batas, rute
     publik ini bisa dipakai membanjiri Redis tanpa perlu akun. */
  const limited = await rateLimitGuard(request, { name: 'oauth-start', limit: 20, windowSeconds: 60 });
  if (limited) return limited;

  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !oauthConfig(provider)) {
    return NextResponse.redirect(new URL('/?auth_error=provider_unavailable', request.url));
  }
  const url = new URL(request.url);
  const returnTo = normalizeOAuthReturnTo(url.searchParams.get('returnTo'), request.url).slice(0, 500);
  const state = await createOAuthState(returnTo);
  const authorizeUrl = buildAuthorizeUrl(provider, state, request.url);
  if (!authorizeUrl) {
    return NextResponse.redirect(new URL('/?auth_error=provider_unavailable', request.url));
  }
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(oauthStateCookieName(provider), state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:' || (process.env.AUTH_URL || '').startsWith('https://'),
    path: `/api/auth/oauth/${provider}/callback`,
    maxAge: 600,
  });
  return response;
}
