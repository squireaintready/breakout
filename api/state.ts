import { Redis } from '@upstash/redis';

const KEY = 'breakout-state';

export default async function handler(req: Request): Promise<Response> {
  const password = process.env.BREAKOUT_PASSWORD;
  if (password) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${password}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const redis = new Redis({
    url: process.env.KV_REST_API_URL || '',
    token: process.env.KV_REST_API_TOKEN || '',
  });

  if (req.method === 'GET') {
    const data = await redis.get(KEY);
    return new Response(JSON.stringify(data || null), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    await redis.set(KEY, JSON.stringify(body));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { runtime: 'edge' };
