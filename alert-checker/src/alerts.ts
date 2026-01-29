import type { AppState, Position } from './types.js';
import { sendTelegram } from './telegram.js';
import { pushState } from './state.js';

const firedSet = new Set<string>();
const cooldownMap = new Map<string, number>();
const COOLDOWN_MS = 30_000;
const startTime = Date.now();

function fmtTs(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

function formatPositions(asset: string, positions: Position[], prices: Map<string, number>): string {
  const matched = positions.filter(p => p.asset === asset);
  if (matched.length === 0) return '';
  const lines = matched.map(p => {
    const cur = prices.get(p.asset);
    const dir = p.side === 'long' ? 1 : -1;
    const pnl = cur ? ((cur - p.entryPrice) * dir / p.entryPrice * p.size) : 0;
    const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    const sl = p.stopLoss != null ? p.stopLoss.toLocaleString() : '—';
    const tp = p.takeProfit != null ? p.takeProfit.toLocaleString() : '—';
    return `  ${p.side.toUpperCase()} $${p.size.toLocaleString()} @ ${p.entryPrice.toLocaleString()} | SL ${sl} | TP ${tp} | P&L ${pnlStr}`;
  });
  return `\n\n<b>Open ${asset} positions:</b>\n${lines.join('\n')}`;
}

function notify(title: string, body: string, positionInfo = '', meta: { createdAt?: number } = {}): void {
  const now = fmtTs(Date.now());
  const created = meta.createdAt ? fmtTs(meta.createdAt) : '';
  const timeInfo = `\n<i>Triggered: ${now}${created ? ` | Set: ${created}` : ''}</i>`;
  const message = `<b>${title}</b>\n${body}${timeInfo}${positionInfo}`;
  console.log(`[alert] ${title} — ${body}`);
  sendTelegram(message);
}

export function cleanFiredSet(state: AppState): void {
  // Remove fired entries for alerts that no longer exist or were re-armed
  for (const id of firedSet) {
    if (id.startsWith('pnl-')) {
      const alertId = id.slice(4);
      const alert = state.pnlAlerts.find(a => a.id === alertId);
      if (!alert || !alert.triggered) firedSet.delete(id);
    } else if (id.startsWith('sl-') || id.startsWith('tp-')) {
      const posId = id.slice(3);
      if (!state.positions.find(p => p.id === posId)) firedSet.delete(id);
    } else {
      // Price alert ID
      const alert = state.priceAlerts.find(a => a.id === id);
      if (!alert || !alert.triggered) firedSet.delete(id);
    }
  }
}

export function checkAlerts(prices: Map<string, number>, state: AppState): void {
  let stateModified = false;

  // 1. Price alerts
  for (const alert of state.priceAlerts) {
    if (alert.triggered) continue;
    if (firedSet.has(alert.id)) continue;
    const price = prices.get(alert.asset);
    if (price == null) continue;

    const hit = alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
    if (hit) {
      const lastFired = cooldownMap.get(alert.id) ?? 0;
      if (Date.now() - lastFired < COOLDOWN_MS) continue;
      cooldownMap.set(alert.id, Date.now());
      if (!alert.persistent) {
        firedSet.add(alert.id);
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        stateModified = true;
      }
      notify(
        `${alert.asset} ${alert.direction === 'above' ? '↑' : '↓'} ${alert.targetPrice}`,
        `${alert.asset} hit ${price.toLocaleString()}${alert.note ? ' — ' + alert.note : ''}`,
        formatPositions(alert.asset, state.positions, prices),
        { createdAt: alert.createdAt },
      );
    }
  }

  // 2. SL/TP for open positions
  for (const pos of state.positions) {
    const price = prices.get(pos.asset);
    if (price == null) continue;
    const dir = pos.side === 'long' ? 1 : -1;

    if (pos.stopLoss != null) {
      const slKey = `sl-${pos.id}`;
      if (!firedSet.has(slKey)) {
        const slHit = dir === 1 ? price <= pos.stopLoss : price >= pos.stopLoss;
        if (slHit) {
          const lastFired = cooldownMap.get(slKey) ?? 0;
          if (Date.now() - lastFired < COOLDOWN_MS) continue;
          firedSet.add(slKey);
          cooldownMap.set(slKey, Date.now());
          notify(
            `STOP LOSS — ${pos.asset}`,
            `${pos.asset} ${pos.side.toUpperCase()} hit SL at ${price.toLocaleString()} (SL: ${pos.stopLoss})`,
            formatPositions(pos.asset, state.positions, prices),
          );
        }
      }
    }

    if (pos.takeProfit != null) {
      const tpKey = `tp-${pos.id}`;
      if (!firedSet.has(tpKey)) {
        const tpHit = dir === 1 ? price >= pos.takeProfit : price <= pos.takeProfit;
        if (tpHit) {
          const lastFired = cooldownMap.get(tpKey) ?? 0;
          if (Date.now() - lastFired < COOLDOWN_MS) continue;
          firedSet.add(tpKey);
          cooldownMap.set(tpKey, Date.now());
          notify(
            `TAKE PROFIT — ${pos.asset}`,
            `${pos.asset} ${pos.side.toUpperCase()} hit TP at ${price.toLocaleString()} (TP: ${pos.takeProfit})`,
            formatPositions(pos.asset, state.positions, prices),
          );
        }
      }
    }
  }

  // 3. P&L alerts — skip for 10s after startup, wait for all position prices
  const allPricesLoaded = state.positions.length === 0 || state.positions.every(p => prices.get(p.asset) != null);
  if (!allPricesLoaded || Date.now() - startTime < 10000) {
    if (stateModified) pushState(state);
    return;
  }

  const totalPnl = state.positions.reduce((sum, pos) => {
    const cur = prices.get(pos.asset);
    if (cur == null) return sum;
    const dir = pos.side === 'long' ? 1 : -1;
    return sum + ((cur - pos.entryPrice) / pos.entryPrice) * pos.size * dir;
  }, 0);

  for (const alert of state.pnlAlerts) {
    const pnlKey = `pnl-${alert.id}`;
    const met = alert.direction === 'above' ? totalPnl >= alert.targetPnl : totalPnl <= alert.targetPnl;

    if (!alert.triggered && met && !firedSet.has(pnlKey)) {
      const lastFired = cooldownMap.get(pnlKey) ?? 0;
      if (Date.now() - lastFired < COOLDOWN_MS) continue;
      cooldownMap.set(pnlKey, Date.now());
      if (!alert.persistent) {
        firedSet.add(pnlKey);
        alert.triggered = true;
        alert.triggeredAt = Date.now();
        stateModified = true;
      }
      const dir = alert.direction === 'above' ? '↑' : '↓';
      notify(
        `P&L ${dir} $${alert.targetPnl}`,
        `Unrealized P&L hit $${totalPnl.toFixed(2)}${alert.note ? ' — ' + alert.note : ''}`,
        '',
        { createdAt: alert.createdAt },
      );
    }

    if (alert.triggered && !met && !alert.persistent) {
      alert.triggered = false;
      alert.triggeredAt = undefined;
      firedSet.delete(pnlKey);
      stateModified = true;
    }
  }

  if (stateModified) pushState(state);
}
