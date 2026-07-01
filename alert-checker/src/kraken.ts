import WebSocket from 'ws';

const KRAKEN_MAP: Record<string, string> = {
  BTC: 'XBT/USD',
  ETH: 'ETH/USD',
  SOL: 'SOL/USD',
  XRP: 'XRP/USD',
  ADA: 'ADA/USD',
  AVAX: 'AVAX/USD',
  DOT: 'DOT/USD',
  LINK: 'LINK/USD',
  MATIC: 'MATIC/USD',
  DOGE: 'DOGE/USD',
  ATOM: 'ATOM/USD',
  UNI: 'UNI/USD',
  LTC: 'LTC/USD',
  NEAR: 'NEAR/USD',
  APT: 'APT/USD',
  ARB: 'ARB/USD',
  OP: 'OP/USD',
  SUI: 'SUI/USD',
  SEI: 'SEI/USD',
  TIA: 'TIA/USD',
  INJ: 'INJ/USD',
  FET: 'FET/USD',
  RNDR: 'RNDR/USD',
  ASTR: 'ASTR/USD',
  HYPE: 'HYPE/USD',
  TRUMP: 'TRUMP/USD',
  TAO: 'TAO/USD',
  PUMP: 'PUMP/USD',
  FARTCOIN: 'FARTCOIN/USD',
  BCH: 'BCH/USD',
  BONK: 'BONK/USD',
  AAVE: 'AAVE/USD',
  LDO: 'LDO/USD',
  KAS: 'KAS/USD',
  BNB: 'BNB/USD',
  PEPE: 'PEPE/USD',
  WIF: 'WIF/USD',
  FLOKI: 'FLOKI/USD',
  SHIB: 'SHIB/USD',
  FIL: 'FIL/USD',
  IMX: 'IMX/USD',
  GRT: 'GRT/USD',
  PENDLE: 'PENDLE/USD',
  JUP: 'JUP/USD',
  ENA: 'ENA/USD',
  ONDO: 'ONDO/USD',
  STX: 'STX/USD',
  MKR: 'MKR/USD',
  RENDER: 'RENDER/USD',
  TRX: 'TRX/USD',
  TON: 'TON/USD',
  XLM: 'XLM/USD',
  ALGO: 'ALGO/USD',
  VET: 'VET/USD',
  SAND: 'SAND/USD',
  MANA: 'MANA/USD',
  AXS: 'AXS/USD',
  CRV: 'CRV/USD',
  SNX: 'SNX/USD',
  COMP: 'COMP/USD',
  SUSHI: 'SUSHI/USD',
  DYDX: 'DYDX/USD',
  BLUR: 'BLUR/USD',
  W: 'W/USD',
  PYTH: 'PYTH/USD',
  JTO: 'JTO/USD',
  STRK: 'STRK/USD',
  MEME: 'MEME/USD',
  ORDI: 'ORDI/USD',
  RUNE: 'RUNE/USD',
  WLD: 'WLD/USD',
  FTM: 'FTM/USD',
};

const reverseMap = new Map<string, string>();
for (const [asset, pair] of Object.entries(KRAKEN_MAP)) {
  reverseMap.set(pair, asset);
}

function fromKrakenPair(pair: string): string | null {
  return reverseMap.get(pair) ?? null;
}

export const prices = new Map<string, number>();
const listeners: Array<() => void> = [];

export function onPrice(cb: () => void): void {
  listeners.push(cb);
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let watchdogTimer: ReturnType<typeof setInterval> | undefined;
let lastMessageAt = 0;
let shuttingDown = false;

// Kraken v2 emits ticker updates plus periodic heartbeats. If nothing arrives
// for this long the socket is treated as dead (half-open connections never fire
// a close event) and force-reconnected — otherwise prices, and therefore every
// alert, would silently stall with no indication.
const STALE_TIMEOUT_MS = 60_000;

export function connect(): void {
  const allPairs = Object.values(KRAKEN_MAP);
  lastMessageAt = Date.now();

  ws = new WebSocket('wss://ws.kraken.com/v2');

  ws.on('open', () => {
    console.log('[kraken] Connected');
    lastMessageAt = Date.now();
    ws!.send(JSON.stringify({
      method: 'subscribe',
      params: { channel: 'ticker', symbol: allPairs },
    }));
  });

  ws.on('message', (raw) => {
    lastMessageAt = Date.now();
    try {
      const data = JSON.parse(raw.toString());
      if (data.channel === 'ticker' && Array.isArray(data.data)) {
        for (const tick of data.data) {
          const asset = fromKrakenPair(tick.symbol);
          const last = Number(tick.last);
          if (asset && Number.isFinite(last)) {
            prices.set(asset, last);
          }
        }
        for (const cb of listeners) cb();
      }
    } catch {
      // Ignore malformed frames; the next valid tick refreshes prices.
    }
  });

  ws.on('close', () => {
    if (shuttingDown) return;
    console.log('[kraken] Disconnected, reconnecting in 3s...');
    reconnectTimer = setTimeout(connect, 3000);
  });

  ws.on('error', (err) => {
    console.error('[kraken] Error:', err.message);
    ws?.close();
  });

  if (!watchdogTimer) {
    watchdogTimer = setInterval(() => {
      if (shuttingDown) return;
      if (Date.now() - lastMessageAt > STALE_TIMEOUT_MS) {
        console.warn('[kraken] Stale connection, forcing reconnect');
        ws?.terminate();
      }
    }, 15_000);
  }
}

export function disconnect(): void {
  shuttingDown = true;
  clearTimeout(reconnectTimer);
  clearInterval(watchdogTimer);
  ws?.close();
}
