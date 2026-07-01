import { useEffect, useRef, useState } from 'react';
import { toKrakenPair, fromKrakenPair } from '../utils/kraken';

export type PriceMap = Record<string, number>;

// How often buffered ticks are flushed into React state. Kraken can emit many
// ticker messages per second across dozens of pairs; batching keeps this to at
// most one re-render per interval instead of one per message.
const FLUSH_INTERVAL_MS = 400;
const RECONNECT_DELAY_MS = 3000;

export function useKrakenPrices(assets: string[]): PriceMap {
  const [prices, setPrices] = useState<PriceMap>({});
  const pendingRef = useRef<PriceMap>({});
  const hasPendingRef = useRef(false);

  useEffect(() => {
    if (assets.length === 0) return;

    let stopped = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const pairs = assets.map(toKrakenPair);

    const connect = () => {
      ws = new WebSocket('wss://ws.kraken.com/v2');

      ws.onopen = () => {
        ws?.send(JSON.stringify({
          method: 'subscribe',
          params: { channel: 'ticker', symbol: pairs },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel === 'ticker' && Array.isArray(data.data)) {
            for (const tick of data.data) {
              const asset = fromKrakenPair(tick.symbol);
              const last = Number(tick.last);
              if (asset && Number.isFinite(last)) {
                pendingRef.current[asset] = last;
                hasPendingRef.current = true;
              }
            }
          }
        } catch {
          // Ignore malformed frames; the next valid tick refreshes prices.
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    const flush = setInterval(() => {
      if (!hasPendingRef.current) return;
      const pending = pendingRef.current;
      pendingRef.current = {};
      hasPendingRef.current = false;
      setPrices(prev => ({ ...prev, ...pending }));
    }, FLUSH_INTERVAL_MS);

    connect();

    return () => {
      stopped = true;
      clearInterval(flush);
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [assets]);

  return prices;
}
