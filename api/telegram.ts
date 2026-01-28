export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { message } = await req.json();
  if (!message) {
    return new Response(JSON.stringify({ error: 'No message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });

  const data = await res.json();
  return new Response(JSON.stringify({ ok: data.ok }), {
    status: data.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { runtime: 'edge' };
