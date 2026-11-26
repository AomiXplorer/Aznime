import { randomToken } from './crypto';
import { kvGetDel, kvSet } from './redis';

export type OAuthProvider = 'google' | 'discord';

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === 'google' || value === 'discord';
}

export function normalizeOAuthReturnTo(value: string | null | undefined, requestUrl: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';

  try {
    const origin = new URL(requestUrl).origin;
    const target = new URL(value, origin);
    if (target.origin !== origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

export function oauthStateCookieName(provider: OAuthProvider): string {
  return `aznime_oauth_state_${provider}`;
}

export function oauthConfig(provider: OAuthProvider): ProviderConfig | null {
  if (provider === 'google') {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) return null;
    return {
      clientId,
      clientSecret,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
    };
  }
  const clientId = (process.env.DISCORD_CLIENT_ID || '').trim();
  const clientSecret = (process.env.DISCORD_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
  };
}

export function oauthRedirectUri(provider: OAuthProvider, requestUrl: string): string {
  const base = (process.env.AUTH_URL || new URL(requestUrl).origin).replace(/\/+$/, '');
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export async function createOAuthState(returnTo: string): Promise<string> {
  const state = randomToken(24);
  await kvSet(`oauthstate:${state}`, JSON.stringify({ returnTo, createdAt: Date.now() }), 600);
  return state;
}

export async function consumeOAuthState(state: string | null): Promise<{ returnTo: string } | null> {
  if (!state) return null;
  const key = `oauthstate:${state}`;
  const raw = await kvGetDel(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { returnTo?: string };
    return { returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : '/' };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(provider: OAuthProvider, state: string, requestUrl: string): string | null {
  const config = oauthConfig(provider);
  if (!config) return null;
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', oauthRedirectUri(provider, requestUrl));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', provider === 'google' ? 'select_account' : 'consent');
  return url.toString();
}

export async function exchangeCodeForProfile(
  provider: OAuthProvider,
  code: string,
  requestUrl: string
): Promise<OAuthProfile | null> {
  const config = oauthConfig(provider);
  if (!config) return null;

  const body = new URLSearchParams();
  body.set('client_id', config.clientId);
  body.set('client_secret', config.clientSecret);
  body.set('code', code);
  body.set('grant_type', 'authorization_code');
  body.set('redirect_uri', oauthRedirectUri(provider, requestUrl));

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
  if (!tokenResponse.ok) return null;

  let accessToken = '';
  try {
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    accessToken = tokenData.access_token || '';
  } catch {
    return null;
  }
  if (!accessToken) return null;

  if (provider === 'google') {
    const info = await fetchJson<{ sub?: string; email?: string; name?: string; picture?: string }>(
      'https://openidconnect.googleapis.com/v1/userinfo',
      accessToken
    );
    if (!info?.sub || !info.email) return null;
    return {
      providerId: info.sub,
      email: info.email.toLowerCase(),
      name: info.name || info.email.split('@')[0],
      avatar: info.picture || null,
    };
  }

  const info = await fetchJson<{ id?: string; email?: string | null; username?: string; global_name?: string; avatar?: string | null }>(
    'https://discord.com/api/users/@me',
    accessToken
  );
  if (!info?.id || !info.email) return null;
  return {
    providerId: info.id,
    email: info.email.toLowerCase(),
    name: info.global_name || info.username || 'Pengguna Discord',
    avatar: info.avatar ? `https://cdn.discordapp.com/avatars/${info.id}/${info.avatar}.png?size=128` : null,
  };
}

async function fetchJson<T>(url: string, accessToken: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
