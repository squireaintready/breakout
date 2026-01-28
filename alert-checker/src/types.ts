export interface Position {
  id: string;
  asset: string;
  side: 'long' | 'short';
  entryPrice: number;
  size: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: number;
}

export interface PriceAlert {
  id: string;
  asset: string;
  targetPrice: number;
  direction: 'above' | 'below';
  note: string;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export interface PnlAlert {
  id: string;
  targetPnl: number;
  direction: 'above' | 'below';
  note: string;
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

export interface Settings {
  startingBalance: number;
  dailyHardDrawdownPct: number;
  totalDrawdownPct: number;
  dailySoftDrawdownPct: number;
  btcEthLeverage: number;
  altLeverage: number;
  dailyResetHourUTC: number;
  darkMode: boolean;
  tradingFeePct: number;
  dailySwapFeePct: number;
}

export interface Trade {
  id: string;
  asset: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  fees: number;
  notes: string;
  tags: string[];
  openedAt: number;
  closedAt: number;
}

export interface EquitySnapshot {
  date: string;
  balance: number;
  drawdownPct: number;
}

export interface AppState {
  balance: number;
  highWaterMark: number;
  dayStartBalance: number;
  lastDailyReset: number;
  realizedPnl: number;
  positions: Position[];
  trades: Trade[];
  equityHistory: EquitySnapshot[];
  settings: Settings;
  priceAlerts: PriceAlert[];
  pnlAlerts: PnlAlert[];
}
