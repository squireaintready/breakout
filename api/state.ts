import { Redis } from '@upstash/redis';

const DEFAULT_ACCOUNT = 'main';

// Resolve which dataset this request targets. Accounts are namespaces, not
// security boundaries — the shared password already gates all access — so we
// only sanitize the id to keep the Redis key well-formed. The default account
// keeps the legacy un-suffixed key so pre-existing data is preserved.
function stateKey(req: Request): string {
  const raw = new URL(req.url).searchParams.get('account') || DEFAULT_ACCOUNT;
  const account = /^[a-z0-9_-]{1,32}$/.test(raw) ? raw : DEFAULT_ACCOUNT;
  return account === DEFAULT_ACCOUNT ? 'breakout-state' : `breakout-state:${account}`;
}

// Constant-time comparison so the shared secret can't be recovered via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  // Fail closed: without a configured secret the endpoint stays locked rather
  // than exposing the trading state to the public internet.
  const password = process.env.BREAKOUT_PASSWORD;
  if (!password) return json({ error: 'Server auth not configured' }, 503);

  const auth = req.headers.get('authorization') || '';
  if (!safeEqual(auth, `Bearer ${password}`)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return json({ error: 'Storage not configured' }, 503);

  const redis = new Redis({ url, token });

  if (req.method === 'GET') {
    const data = await redis.get(stateKey(req));
    return json(data || null);
  }

  if (req.method === 'PUT') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    if (body === null || typeof body !== 'object') {
      return json({ error: 'Invalid payload' }, 400);
    }
    await redis.set(stateKey(req), JSON.stringify(body));
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

export const config = { runtime: 'edge' };
