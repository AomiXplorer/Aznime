import { NextRequest, NextResponse } from 'next/server';
import {
  BYPASS_COOKIE_NAME,
  BYPASS_HINT_COOKIE_NAME,
  verifyBypassToken,
} from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

const BYPASS_MAX_AGE_SECONDS = 12 * 60 * 60;

function buildSetCookieHeader(name: string, value: string, maxAge: number, httpOnly: boolean): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=None',
    'Secure',
    'Partitioned',
  ];
  if (httpOnly) parts.push('HttpOnly');
  return parts.join('; ');
}

export async function GET(req: NextRequest) {
  const exit = req.nextUrl.searchParams.get('exit');
  if (exit === '1') {
    const res = NextResponse.redirect(new URL('/', req.url), { status: 302 });
    res.headers.append('Set-Cookie', buildSetCookieHeader(BYPASS_COOKIE_NAME, '', 0, true));
    res.headers.append('Set-Cookie', buildSetCookieHeader(BYPASS_HINT_COOKIE_NAME, '', 0, false));
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  }

  const token = req.nextUrl.searchParams.get('token');
  const valid = await verifyBypassToken(token);
  if (!valid || !token) {
    return NextResponse.redirect(new URL('/maintenance?bypass=invalid', req.url), {
      status: 302,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

  const res = NextResponse.redirect(new URL('/', req.url), { status: 302 });
  res.headers.append('Set-Cookie', buildSetCookieHeader(BYPASS_COOKIE_NAME, token, BYPASS_MAX_AGE_SECONDS, true));
  res.headers.append('Set-Cookie', buildSetCookieHeader(BYPASS_HINT_COOKIE_NAME, '1', BYPASS_MAX_AGE_SECONDS, false));
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
