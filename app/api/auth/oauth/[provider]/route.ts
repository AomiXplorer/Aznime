import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { buildAuthorizeUrl, createOAuthState, isOAuthProvider, oauthConfig } from '@/lib/auth/oauth';
=======
import {
  buildAuthorizeUrl,
  createOAuthState,
  isOAuthProvider,
  normalizeOAuthReturnTo,
  oauthConfig,
  oauthStateCookieName,
} from '@/lib/auth/oauth';
>>>>>>> c5dfbd0 (Update maintennace)

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !oauthConfig(provider)) {
    return NextResponse.redirect(new URL('/?auth_error=provider_unavailable', request.url));
  }
  const url = new URL(request.url);
<<<<<<< HEAD
  const returnTo = url.searchParams.get('returnTo') || '/';
  const state = await createOAuthState(returnTo.slice(0, 500));
=======
  const returnTo = normalizeOAuthReturnTo(url.searchParams.get('returnTo'), request.url).slice(0, 500);
  const state = await createOAuthState(returnTo);
>>>>>>> c5dfbd0 (Update maintennace)
  const authorizeUrl = buildAuthorizeUrl(provider, state, request.url);
  if (!authorizeUrl) {
    return NextResponse.redirect(new URL('/?auth_error=provider_unavailable', request.url));
  }
<<<<<<< HEAD
  return NextResponse.redirect(authorizeUrl);
=======
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(oauthStateCookieName(provider), state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:' || (process.env.AUTH_URL || '').startsWith('https://'),
    path: `/api/auth/oauth/${provider}/callback`,
    maxAge: 600,
  });
  return response;
>>>>>>> c5dfbd0 (Update maintennace)
}
