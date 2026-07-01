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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Fail closed: an unconfigured secret must not leave the notifier open to
  // anonymous spam.
  const password = process.env.BREAKOUT_PASSWORD;
  if (!password) return json({ error: 'Server auth not configured' }, 503);

  const auth = req.headers.get('authorization') || '';
  if (!safeEqual(auth, `Bearer ${password}`)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return json({ error: 'Telegram not configured' }, 503);

  let message: unknown;
  try {
    ({ message } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (typeof message !== 'string' || message.length === 0) {
    return json({ error: 'No message' }, 400);
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 4096), parse_mode: 'HTML' }),
  });

  const data = await res.json();
  return json({ ok: data.ok }, data.ok ? 200 : 502);
}

export const config = { runtime: 'edge' };
