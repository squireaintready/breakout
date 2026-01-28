import { useEffect, useRef, useState, useCallback } from 'react';
import { toKrakenPair, fromKrakenPair } from '../utils/kraken';

export type PriceMap = Record<string, number>;

export function useKrakenPrices(assets: string[]): PriceMap {
  const [prices, setPrices] = useState<PriceMap>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (assets.length === 0) return;

    const pairs = assets.map(toKrakenPair);
    const ws = new WebSocket('wss://ws.kraken.com/v2');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        method: 'subscribe',
        params: { channel: 'ticker', symbol: pairs },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.channel === 'ticker' && data.data) {
          for (const tick of data.data) {
            const asset = fromKrakenPair(tick.symbol);
            if (asset && tick.last !== undefined) {
              setPrices(prev => ({ ...prev, [asset]: tick.last }));
            }
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [assets.join(',')]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return prices;
}
