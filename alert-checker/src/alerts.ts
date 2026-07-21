import type { AppState, Position, AccountRef } from './types.js';
import { sendTelegram } from './telegram.js';
import { pushState } from './state.js';

// De-dupe/cooldown bookkeeping is shared across all watched accounts, so every
// key is namespaced with `${accountId}::` to keep accounts fully isolated.
const firedSet = new Set<string>();
const cooldownMap = new Map<string, number>();
const armedSet = new Set<string>();
const COOLDOWN_MS = 120_000;
const startTime = Date.now();

function fmtTs(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

// Escape user-supplied text before it goes into a parse_mode: 'HTML' message.
// An unescaped '<', '>' or '&' in a note makes Telegram reject the whole
// message, silently dropping the alert.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

function notify(label: string, title: string, body: string, positionInfo = '', meta: { createdAt?: number } = {}): void {
  const now = fmtTs(Date.now());
  const created = meta.createdAt ? fmtTs(meta.createdAt) : '';
  const timeInfo = `\n<i>Triggered: ${now}${created ? ` | Set: ${created}` : ''}</i>`;
  const message = `<b>[${label}] ${title}</b>\n${body}${timeInfo}${positionInfo}`;
  console.log(`[alert] [${label}] ${title} — ${body}`);
  sendTelegram(message);
}

// Does the entity a cooldown/armed key refers to still exist in state?
// `key` here is the account-local key (prefix already stripped).
function keyStillRelevant(key: string, state: AppState): boolean {
  if (key.startsWith('pnl-')) return state.pnlAlerts.some(a => a.id === key.slice(4));
  if (key.startsWith('sl-') || key.startsWith('tp-')) return state.positions.some(p => p.id === key.slice(3));
  return state.priceAlerts.some(a => a.id === key);
}

export function cleanFiredSet(accountId: string, state: AppState): void {
  const prefix = `${accountId}::`;

  // Remove fired entries for alerts that no longer exist or were re-armed
  for (const id of firedSet) {
    if (!id.startsWith(prefix)) continue;
    const localId = id.slice(prefix.length);
    if (localId.startsWith('pnl-')) {
      const alertId = localId.slice(4);
      const alert = state.pnlAlerts.find(a => a.id === alertId);
      if (!alert || !alert.triggered) firedSet.delete(id);
    } else if (localId.startsWith('sl-') || localId.startsWith('tp-')) {
      const posId = localId.slice(3);
      if (!state.positions.find(p => p.id === posId)) firedSet.delete(id);
    } else {
      // Price alert ID
      const alert = state.priceAlerts.find(a => a.id === localId);
      if (!alert || !alert.triggered) firedSet.delete(id);
    }
  }

  // Prune cooldown/armed bookkeeping for deleted alerts/positions so these
  // maps don't grow unbounded and stale entries can't skew later checks.
  for (const key of cooldownMap.keys()) {
    if (!key.startsWith(prefix)) continue;
    if (!keyStillRelevant(key.slice(prefix.length), state)) cooldownMap.delete(key);
  }
  for (const key of armedSet) {
    if (!key.startsWith(prefix)) continue;
    if (!keyStillRelevant(key.slice(prefix.length), state)) armedSet.delete(key);
  }
}

export function checkAlerts(prices: Map<string, number>, account: AccountRef, state: AppState): void {
  const P = (k: string) => `${account.id}::${k}`;
  let stateModified = false;

  // 1. Price alerts (crossover: must see safe side before firing)
  for (const alert of state.priceAlerts) {
    if (alert.triggered) continue;
    const aKey = P(alert.id);
    if (firedSet.has(aKey)) continue;
    const price = prices.get(alert.asset);
    if (price == null) continue;

    const hit = alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
    if (!hit) {
      armedSet.add(aKey);
      continue;
    }
    if (!armedSet.has(aKey)) continue;
    const lastFired = cooldownMap.get(aKey) ?? 0;
    if (Date.now() - lastFired < COOLDOWN_MS) continue;
    cooldownMap.set(aKey, Date.now());
    if (!alert.persistent) {
      firedSet.add(aKey);
      armedSet.delete(aKey);
      alert.triggered = true;
      alert.triggeredAt = Date.now();
      stateModified = true;
    } else {
      armedSet.delete(aKey);
    }
    notify(
      account.label,
      `${alert.asset} ${alert.direction === 'above' ? '↑' : '↓'} ${alert.targetPrice}`,
      `${alert.asset} hit ${price.toLocaleString()}${alert.note ? ' — ' + esc(alert.note) : ''}`,
      formatPositions(alert.asset, state.positions, prices),
      { createdAt: alert.createdAt },
    );
  }

  // 2. SL/TP for open positions
  for (const pos of state.positions) {
    const price = prices.get(pos.asset);
    if (price == null) continue;
    const dir = pos.side === 'long' ? 1 : -1;

    if (pos.stopLoss != null) {
      const slKey = P(`sl-${pos.id}`);
      const slHit = dir === 1 ? price <= pos.stopLoss : price >= pos.stopLoss;
      const lastFired = cooldownMap.get(slKey) ?? 0;
      if (!firedSet.has(slKey) && slHit && Date.now() - lastFired >= COOLDOWN_MS) {
        firedSet.add(slKey);
        cooldownMap.set(slKey, Date.now());
        notify(
          account.label,
          `STOP LOSS — ${pos.asset}`,
          `${pos.asset} ${pos.side.toUpperCase()} hit SL at ${price.toLocaleString()} (SL: ${pos.stopLoss})`,
          formatPositions(pos.asset, state.positions, prices),
        );
      }
    }

    if (pos.takeProfit != null) {
      const tpKey = P(`tp-${pos.id}`);
      const tpHit = dir === 1 ? price >= pos.takeProfit : price <= pos.takeProfit;
      const lastFired = cooldownMap.get(tpKey) ?? 0;
      if (!firedSet.has(tpKey) && tpHit && Date.now() - lastFired >= COOLDOWN_MS) {
        firedSet.add(tpKey);
        cooldownMap.set(tpKey, Date.now());
        notify(
          account.label,
          `TAKE PROFIT — ${pos.asset}`,
          `${pos.asset} ${pos.side.toUpperCase()} hit TP at ${price.toLocaleString()} (TP: ${pos.takeProfit})`,
          formatPositions(pos.asset, state.positions, prices),
        );
      }
    }
  }

  // 3. P&L alerts — skip only for the first 10s after startup so prices can
  //    load. P&L is summed over positions that have a price (an un-mapped or
  //    delisted asset is skipped rather than disabling every P&L alert).
  if (Date.now() - startTime < 10000) {
    if (stateModified) pushState(account.id, state);
    return;
  }

  const totalPnl = state.positions.reduce((sum, pos) => {
    const cur = prices.get(pos.asset);
    if (cur == null) return sum;
    const dir = pos.side === 'long' ? 1 : -1;
    return sum + ((cur - pos.entryPrice) / pos.entryPrice) * pos.size * dir;
  }, 0);

  for (const alert of state.pnlAlerts) {
    const pnlKey = P(`pnl-${alert.id}`);
    const met = alert.direction === 'above' ? totalPnl >= alert.targetPnl : totalPnl <= alert.targetPnl;

    if (!alert.triggered && !firedSet.has(pnlKey)) {
      if (!met) {
        armedSet.add(pnlKey);
      } else if (armedSet.has(pnlKey)) {
        const lastFired = cooldownMap.get(pnlKey) ?? 0;
        if (Date.now() - lastFired < COOLDOWN_MS) continue;
        cooldownMap.set(pnlKey, Date.now());
        if (!alert.persistent) {
          firedSet.add(pnlKey);
          armedSet.delete(pnlKey);
          alert.triggered = true;
          alert.triggeredAt = Date.now();
          stateModified = true;
        } else {
          armedSet.delete(pnlKey);
        }
        const dir = alert.direction === 'above' ? '↑' : '↓';
        notify(
          account.label,
          `P&amp;L ${dir} $${alert.targetPnl}`,
          `Unrealized P&amp;L hit $${totalPnl.toFixed(2)}${alert.note ? ' — ' + esc(alert.note) : ''}`,
          '',
          { createdAt: alert.createdAt },
        );
      }
    }

    if (alert.triggered && !met && !alert.persistent) {
      alert.triggered = false;
      alert.triggeredAt = undefined;
      firedSet.delete(pnlKey);
      stateModified = true;
    }
  }

  if (stateModified) pushState(account.id, state);
}
