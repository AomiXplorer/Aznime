import { NextResponse, type NextRequest } from 'next/server';
import {
  computeRetryAfterSeconds,
  getMaintenanceState,
} from '@/lib/maintenance';

const ALLOWLIST_EXACT = new Set([
  '/maintenance',
  '/api/telegram/webhook',
  '/api/maintenance/status',
  '/favicon.ico',
  '/apple-icon.png',
  '/icon.png',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
]);

const ALLOWLIST_PREFIXES = [
  '/_next/',
  '/icons/',
  '/og/',
  '/assets/',
  '/maintenance/',
];

function isAllowlistedPath(pathname: string): boolean {
  if (ALLOWLIST_EXACT.has(pathname)) return true;
  return ALLOWLIST_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAllowlistedPath(pathname)) {
    return NextResponse.next();
  }

  const state = await getMaintenanceState();
  if (!state.enabled) {
    return NextResponse.next();
  }

  const retryAfter = String(computeRetryAfterSeconds(state.endsAt));
  const headers = {
    'Retry-After': retryAfter,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: 'Aznime sedang dalam mode maintenance.',
        maintenance: true,
        message: state.message,
        endsAt: state.endsAt,
      },
      { status: 503, headers }
    );
  }

  return NextResponse.rewrite(new URL('/maintenance', request.url), {
    status: 503,
    headers,
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icons/|og/|assets/|favicon\\.ico|apple-icon\\.png|icon\\.png|manifest\\.webmanifest).*)',
  ],
};
