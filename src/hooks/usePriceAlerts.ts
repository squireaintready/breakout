import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import type { Position } from '../store/useStore';
import type { PriceMap } from './useKrakenPrices';

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    // Two-tone beep
    [520, 680].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.12);
    });
  } catch {}
}

function sendTelegram(message: string) {
  const pw = localStorage.getItem('breakout-password') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (pw) headers['Authorization'] = `Bearer ${pw}`;
  fetch('/api/telegram', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  }).catch(() => {});
}

function formatPositions(asset: string, positions: Position[], prices: PriceMap): string {
  const matched = positions.filter(p => p.asset === asset);
  if (matched.length === 0) return '';
  const lines = matched.map(p => {
    const cur = prices[p.asset];
    const dir = p.side === 'long' ? 1 : -1;
    const pnl = cur ? ((cur - p.entryPrice) * dir / p.entryPrice * p.size) : 0;
    const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    const sl = p.stopLoss != null ? p.stopLoss.toLocaleString() : '—';
    const tp = p.takeProfit != null ? p.takeProfit.toLocaleString() : '—';
    return `  ${p.side.toUpperCase()} $${p.size.toLocaleString()} @ ${p.entryPrice.toLocaleString()} | SL ${sl} | TP ${tp} | P&L ${pnlStr}`;
  });
  return `\n\n<b>Open ${asset} positions:</b>\n${lines.join('\n')}`;
}

function fmtTs(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
}

function notify(title: string, body: string, positionInfo: string = '', meta: { createdAt?: number } = {}) {
  playAlertSound();
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
  const now = fmtTs(Date.now());
  const created = meta.createdAt ? fmtTs(meta.createdAt) : '';
  const timeInfo = `\n<i>Triggered: ${now}${created ? ` | Set: ${created}` : ''}</i>`;
  sendTelegram(`<b>${title}</b>\n${body}${timeInfo}${positionInfo}`);
}

const COOLDOWN_MS = 30_000;

export function usePriceAlerts(prices: PriceMap) {
  const { priceAlerts, pnlAlerts, positions, markAlertTriggered, markPnlAlertTriggered, resetPnlAlert } = useStore();
  const firedRef = useRef<Set<string>>(new Set());
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const mountTime = useRef(Date.now());

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Clear firedRef for re-armed alerts (triggered reset to false)
    for (const alert of priceAlerts) {
      if (!alert.triggered && firedRef.current.has(alert.id)) {
        firedRef.current.delete(alert.id);
      }
    }

    // Check custom alerts
    for (const alert of priceAlerts) {
      if (alert.triggered) continue;
      if (firedRef.current.has(alert.id)) continue;
      const price = prices[alert.asset];
      if (price == null) continue;

      const hit = alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
      if (hit) {
        const lastFired = cooldownRef.current.get(alert.id) ?? 0;
        if (Date.now() - lastFired < COOLDOWN_MS) continue;
        cooldownRef.current.set(alert.id, Date.now());
        if (!alert.persistent) {
          firedRef.current.add(alert.id);
          markAlertTriggered(alert.id);
        }
        notify(
          `${alert.asset} ${alert.direction === 'above' ? '↑' : '↓'} ${alert.targetPrice}`,
          `${alert.asset} hit ${price.toLocaleString()}${alert.note ? ' — ' + alert.note : ''}`,
          formatPositions(alert.asset, positions, prices),
          { createdAt: alert.createdAt }
        );
      }
    }

    // Check auto SL/TP for open positions
    for (const pos of positions) {
      const price = prices[pos.asset];
      if (price == null) continue;
      const dir = pos.side === 'long' ? 1 : -1;

      if (pos.stopLoss != null) {
        const slKey = `sl-${pos.id}`;
        if (!firedRef.current.has(slKey)) {
          const slHit = dir === 1 ? price <= pos.stopLoss : price >= pos.stopLoss;
          if (slHit) {
            const lastFired = cooldownRef.current.get(slKey) ?? 0;
            if (Date.now() - lastFired < COOLDOWN_MS) continue;
            firedRef.current.add(slKey);
            cooldownRef.current.set(slKey, Date.now());
            notify(
              `STOP LOSS — ${pos.asset}`,
              `${pos.asset} ${pos.side.toUpperCase()} hit SL at ${price.toLocaleString()} (SL: ${pos.stopLoss})`,
              formatPositions(pos.asset, positions, prices)
            );
          }
        }
      }

      if (pos.takeProfit != null) {
        const tpKey = `tp-${pos.id}`;
        if (!firedRef.current.has(tpKey)) {
          const tpHit = dir === 1 ? price >= pos.takeProfit : price <= pos.takeProfit;
          if (tpHit) {
            const lastFired = cooldownRef.current.get(tpKey) ?? 0;
            if (Date.now() - lastFired < COOLDOWN_MS) continue;
            firedRef.current.add(tpKey);
            cooldownRef.current.set(tpKey, Date.now());
            notify(
              `TAKE PROFIT — ${pos.asset}`,
              `${pos.asset} ${pos.side.toUpperCase()} hit TP at ${price.toLocaleString()} (TP: ${pos.takeProfit})`,
              formatPositions(pos.asset, positions, prices)
            );
          }
        }
      }
    }

    // P&L alerts — skip until all position prices loaded AND 5s after mount
    const allPricesLoaded = positions.length === 0 || positions.every(p => prices[p.asset] != null);
    if (!allPricesLoaded || Date.now() - mountTime.current < 5000) return;

    const totalPnl = positions.reduce((sum, pos) => {
      const cur = prices[pos.asset];
      if (cur == null) return sum;
      const dir = pos.side === 'long' ? 1 : -1;
      return sum + ((cur - pos.entryPrice) / pos.entryPrice) * pos.size * dir;
    }, 0);

    for (const alert of pnlAlerts) {
      const pnlKey = `pnl-${alert.id}`;
      const met = alert.direction === 'above' ? totalPnl >= alert.targetPnl : totalPnl <= alert.targetPnl;

      if (!alert.triggered && met && !firedRef.current.has(pnlKey)) {
        const lastFired = cooldownRef.current.get(pnlKey) ?? 0;
        if (Date.now() - lastFired < COOLDOWN_MS) continue;
        cooldownRef.current.set(pnlKey, Date.now());
        if (!alert.persistent) {
          firedRef.current.add(pnlKey);
          markPnlAlertTriggered(alert.id);
        }
        const dir = alert.direction === 'above' ? '↑' : '↓';
        notify(
          `P&L ${dir} $${alert.targetPnl}`,
          `Unrealized P&L hit $${totalPnl.toFixed(2)}${alert.note ? ' — ' + alert.note : ''}`,
          '',
          { createdAt: alert.createdAt }
        );
      }

      if (alert.triggered && !met && !alert.persistent) {
        resetPnlAlert(alert.id);
        firedRef.current.delete(pnlKey);
      }
    }
  }, [prices, priceAlerts, pnlAlerts, positions, markAlertTriggered, markPnlAlertTriggered, resetPnlAlert]);
}
