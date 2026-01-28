import type { Position } from '../store/useStore';

export function calcDailyDrawdownPct(
  currentBalance: number,
  dayStartBalance: number,
): number {
  if (dayStartBalance <= 0) return 0;
  const dd = ((dayStartBalance - currentBalance) / dayStartBalance) * 100;
  return Math.max(0, dd);
}

export function calcTotalDrawdownPct(
  currentBalance: number,
  highWaterMark: number,
): number {
  if (highWaterMark <= 0) return 0;
  const dd = ((highWaterMark - currentBalance) / highWaterMark) * 100;
  return Math.max(0, dd);
}

export function calcRiskIfAllStopsHit(
  positions: Position[],
  balance: number,
  tradingFeePct: number,
): number {
  let totalRisk = 0;
  for (const pos of positions) {
    if (!pos.stopLoss) continue;
    const stopDist = Math.abs(pos.entryPrice - pos.stopLoss) / pos.entryPrice;
    const posRisk = pos.size * stopDist;
    const exitFee = pos.size * (tradingFeePct / 100);
    totalRisk += posRisk + exitFee;
  }
  return balance > 0 ? (totalRisk / balance) * 100 : 0;
}

export function getDrawdownZone(pct: number, limit: number): 'green' | 'yellow' | 'red' {
  const ratio = pct / limit;
  if (ratio < 0.5) return 'green';
  if (ratio < 0.8) return 'yellow';
  return 'red';
}

export function getDailyRiskBudgetUsed(
  positions: Position[],
  balance: number,
  tradingFeePct: number,
): number {
  return calcRiskIfAllStopsHit(positions, balance, tradingFeePct);
}

export function shouldResetDaily(lastResetTimestamp: number, resetHourUTC: number): boolean {
  const now = new Date();

  const nowUTCDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHourUTC);
  const currentResetPoint = now.getTime() >= nowUTCDay ? nowUTCDay : nowUTCDay - 86400000;

  return lastResetTimestamp < currentResetPoint;
}
