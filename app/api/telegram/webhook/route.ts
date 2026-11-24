import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqualString } from '@/lib/maintenance';
import { SITE_URL } from '@/lib/site';
import { handleTelegramUpdate, type TelegramUpdate } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

function resolveSiteOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost.trim())) {
    const protoHeader = req.headers.get('x-forwarded-proto');
    const proto =
      protoHeader === 'http' || protoHeader === 'https'
        ? protoHeader
        : forwardedHost.startsWith('localhost') || forwardedHost.startsWith('127.0.0.1')
          ? 'http'
          : 'https';
    return `${proto}://${forwardedHost.trim()}`;
  }
  return SITE_URL;
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
  const providedSecret = req.headers.get('x-telegram-bot-api-secret-token')?.trim() || '';

  if (!expectedSecret) {
    console.error(
      '[Telegram Webhook] Rejected 401: TELEGRAM_WEBHOOK_SECRET belum diatur atau belum Redeploy di environment server.'
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!providedSecret) {
    console.warn(
      '[Telegram Webhook] Rejected 401: Header X-Telegram-Bot-Api-Secret-Token kosong. Pastikan setWebhook menyertakan secret_token.'
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!timingSafeEqualString(providedSecret, expectedSecret)) {
    console.warn(
      `[Telegram Webhook] Rejected 401: Secret token tidak cocok (providedLength=${providedSecret.length}, expectedLength=${expectedSecret.length}).`
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    console.warn('[Telegram Webhook] Rejected 400: Body JSON tidak valid.');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!update || typeof update !== 'object') {
    console.warn('[Telegram Webhook] Rejected 400: Struktur update Telegram tidak valid.');
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
  }

  try {
    await handleTelegramUpdate(update, resolveSiteOrigin(req));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Telegram Webhook Error]', message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
