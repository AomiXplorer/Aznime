export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { ok: true, release: process.env.AZNIME_RELEASE_SHA || null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
