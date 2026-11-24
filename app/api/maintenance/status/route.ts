import { NextRequest, NextResponse } from 'next/server';
import { BYPASS_COOKIE_NAME, getMaintenanceState, verifyBypassToken } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
