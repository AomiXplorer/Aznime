import { NextResponse } from 'next/server';
import { buildAuthorizeUrl, createOAuthState, isOAuthProvider, oauthConfig } from '@/lib/auth/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !oauthConfig(provider)) {
    return NextResponse.redirect(new URL('/?auth_error=provider_unavailable', request.url));
  }
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') || '/';
  const state = await createOAuthState(returnTo.slice(0, 500));
  const authorizeUrl = buildAuthorizeUrl(provider, state, request.url);
  if (!authorizeUrl) {
    return NextResponse.redirect(new URL('/?auth_error=provider_unavailable', request.url));
  }
  return NextResponse.redirect(authorizeUrl);
}
