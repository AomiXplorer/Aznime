import { NextRequest, NextResponse } from 'next/server';
import { rateLimitGuard } from '@/lib/api-guard';
import { BYPASS_COOKIE_NAME, getMaintenanceState, verifyBypassToken } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  /* Rute ini sengaja melewati cache status maintenance, jadi setiap panggilan
     membaca Redis. Batas per IP menjaga agar tidak bisa dipakai membanjiri
     Redis atau memanaskan fungsi serverless. */
  const limited = await rateLimitGuard(req, { name: 'maintenance-status', limit: 120, windowSeconds: 60 });
  if (limited) return limited;

  const state = await getMaintenanceState({ bypassCache: true });
  const bypassToken = req.cookies.get(BYPASS_COOKIE_NAME)?.value;
  const bypassActive = await verifyBypassToken(bypassToken);

  return NextResponse.json(
    {
      enabled: state.enabled,
      message: state.message,
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      bypassActive,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
