import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PersistenceError } from './config';

let client: SupabaseClient | undefined;

export function database(): SupabaseClient {
  if (typeof window !== 'undefined') throw new PersistenceError();
  if (client) return client;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const raw = process.env.SUPABASE_URL?.trim();
  if (!key || !raw || !URL.canParse(raw)) throw new PersistenceError();
  const url = new URL(raw);
  const local = process.env.VERCEL_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new PersistenceError();
  }

  client = createClient(url.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const deadline = AbortSignal.timeout(5000);
        return fetch(input, {
          ...init, cache: 'no-store', redirect: 'error',
          signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
        });
      },
    },
  });
  return client;
}
