import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { shouldResetDaily } from '../utils/drawdown';

export interface Position {
  id: string;
  asset: string;
  side: 'long' | 'short';
  entryPrice: number;
  size: number; // notional value in USD
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: number;
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
  date: string; // YYYY-MM-DD
  balance: number;
  drawdownPct: number;
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

// Data keys that get persisted (excludes functions)
const DATA_KEYS = [
  'balance', 'highWaterMark', 'dayStartBalance', 'lastDailyReset',
  'realizedPnl', 'positions', 'trades', 'equityHistory', 'settings', 'priceAlerts', 'pnlAlerts',
] as const;

export interface StoreState {
  balance: number;
  highWaterMark: number;
  dayStartBalance: number;
  lastDailyReset: number;
  realizedPnl: number;
  positions: Position[];
  trades: Trade[];
  equityHistory: EquitySnapshot[];
  priceAlerts: PriceAlert[];
  pnlAlerts: PnlAlert[];
  settings: Settings;
  _syncing: boolean;
  _lastCloud: number;

  addPosition: (pos: Omit<Position, 'id' | 'openedAt'>) => void;
  closePosition: (id: string, exitPrice: number, notes?: string, tags?: string[]) => void;
  updatePositionStop: (id: string, stopLoss: number | null) => void;
  updatePositionTP: (id: string, takeProfit: number | null) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setBalance: (b: number) => void;
  checkDailyReset: () => void;
  addEquitySnapshot: () => void;
  importData: (data: Partial<StoreState>) => void;
  resetAccount: () => void;
  editTrade: (id: string, updates: Partial<Pick<Trade, 'notes' | 'tags' | 'fees'>>) => void;
  deleteTrade: (id: string) => void;
  deletePosition: (id: string) => void;
  addPriceAlert: (alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>) => void;
  deletePriceAlert: (id: string) => void;
  markAlertTriggered: (id: string) => void;
  editPriceAlert: (id: string, updates: Partial<Pick<PriceAlert, 'targetPrice' | 'direction' | 'note'>>) => void;
  rearmAlert: (id: string, updates: Partial<Pick<PriceAlert, 'targetPrice' | 'direction'>>) => void;
  dismissAlert: (id: string) => void;
  addPnlAlert: (alert: Omit<PnlAlert, 'id' | 'triggered' | 'createdAt'>) => void;
  deletePnlAlert: (id: string) => void;
  editPnlAlert: (id: string, updates: Partial<Pick<PnlAlert, 'targetPnl' | 'direction' | 'note'>>) => void;
  markPnlAlertTriggered: (id: string) => void;
  resetPnlAlert: (id: string) => void;
  dismissPnlAlert: (id: string) => void;
  rearmPnlAlert: (id: string, updates: Partial<Pick<PnlAlert, 'targetPnl' | 'direction'>>) => void;
  applySwapFees: () => void;
  pullCloud: () => Promise<void>;
  pushCloud: () => Promise<void>;
}

function getDataSnapshot(state: StoreState) {
  const snap: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    snap[key] = state[key];
  }
  return snap;
}

// Debounced push
let pushTimer: ReturnType<typeof setTimeout> | undefined;
function debouncedPush(fn: () => void) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(fn, 1500);
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      balance: DEFAULT_SETTINGS.startingBalance,
      highWaterMark: DEFAULT_SETTINGS.startingBalance,
      dayStartBalance: DEFAULT_SETTINGS.startingBalance,
      lastDailyReset: Date.now(),
      realizedPnl: 0,
      positions: [],
      trades: [],
      equityHistory: [],
      priceAlerts: [],
      pnlAlerts: [],
      settings: { ...DEFAULT_SETTINGS },
      _syncing: false,
      _lastCloud: 0,

      addPosition: (pos) => {
        const state = get();
        const entryFee = pos.size * (state.settings.tradingFeePct / 100);
        set({
          positions: [...state.positions, { ...pos, id: crypto.randomUUID(), openedAt: Date.now() }],
          balance: state.balance - entryFee,
        });
        debouncedPush(() => get().pushCloud());
      },

      closePosition: (id, exitPrice, notes = '', tags = []) => {
        const state = get();
        const pos = state.positions.find(p => p.id === id);
        if (!pos) return;

        const direction = pos.side === 'long' ? 1 : -1;
        const priceDiff = (exitPrice - pos.entryPrice) * direction;
        const pnl = (priceDiff / pos.entryPrice) * pos.size;
        const exitFee = pos.size * (state.settings.tradingFeePct / 100);
        const entryFee = pos.size * (state.settings.tradingFeePct / 100);
        const totalFees = entryFee + exitFee;

        const trade: Trade = {
          id: crypto.randomUUID(),
          asset: pos.asset,
          side: pos.side,
          entryPrice: pos.entryPrice,
          exitPrice,
          size: pos.size,
          pnl: pnl - exitFee,
          fees: totalFees,
          notes,
          tags,
          openedAt: pos.openedAt,
          closedAt: Date.now(),
        };

        const newBalance = state.balance + pnl - exitFee;
        const newHWM = Math.max(state.highWaterMark, newBalance);

        set({
          positions: state.positions.filter(p => p.id !== id),
          trades: [...state.trades, trade],
          balance: newBalance,
          highWaterMark: newHWM,
          realizedPnl: state.realizedPnl + trade.pnl,
        });
        debouncedPush(() => get().pushCloud());
      },

      updatePositionStop: (id, stopLoss) => {
        set(state => ({
          positions: state.positions.map(p => p.id === id ? { ...p, stopLoss } : p),
        }));
        debouncedPush(() => get().pushCloud());
      },

      updatePositionTP: (id, takeProfit) => {
        set(state => ({
          positions: state.positions.map(p => p.id === id ? { ...p, takeProfit } : p),
        }));
        debouncedPush(() => get().pushCloud());
      },

      updateSettings: (s) => {
        set(state => ({ settings: { ...state.settings, ...s } }));
        debouncedPush(() => get().pushCloud());
      },

      setBalance: (b) => {
        set({ balance: b, highWaterMark: Math.max(get().highWaterMark, b), dayStartBalance: b });
        debouncedPush(() => get().pushCloud());
      },

      checkDailyReset: () => {
        const state = get();
        if (shouldResetDaily(state.lastDailyReset, state.settings.dailyResetHourUTC)) {
          set({
            dayStartBalance: state.balance,
            lastDailyReset: Date.now(),
          });
          get().addEquitySnapshot();
          debouncedPush(() => get().pushCloud());
        }
      },

      addEquitySnapshot: () => {
        const state = get();
        const today = new Date().toISOString().slice(0, 10);
        const existing = state.equityHistory.filter(e => e.date !== today);
        const totalDD = state.highWaterMark > 0
          ? ((state.highWaterMark - state.balance) / state.highWaterMark) * 100
          : 0;
        set({
          equityHistory: [...existing, { date: today, balance: state.balance, drawdownPct: Math.max(0, totalDD) }],
        });
      },

      importData: (data) => {
        set({ ...data } as Partial<StoreState>);
        debouncedPush(() => get().pushCloud());
      },

      resetAccount: () => {
        const s = get().settings;
        set({
          balance: s.startingBalance,
          highWaterMark: s.startingBalance,
          dayStartBalance: s.startingBalance,
          lastDailyReset: Date.now(),
          realizedPnl: 0,
          positions: [],
          trades: [],
          equityHistory: [],
        });
        debouncedPush(() => get().pushCloud());
      },

      editTrade: (id, updates) => {
        set(state => ({
          trades: state.trades.map(t => t.id === id ? { ...t, ...updates } : t),
        }));
        debouncedPush(() => get().pushCloud());
      },

      deleteTrade: (id) => {
        const state = get();
        const trade = state.trades.find(t => t.id === id);
        if (!trade) return;
        set({
          trades: state.trades.filter(t => t.id !== id),
          realizedPnl: state.realizedPnl - trade.pnl,
          balance: state.balance - trade.pnl,
        });
        debouncedPush(() => get().pushCloud());
      },

      deletePosition: (id) => {
        const state = get();
        const pos = state.positions.find(p => p.id === id);
        if (!pos) return;
        // Refund the entry fee that was deducted when opening
        const entryFee = pos.size * (state.settings.tradingFeePct / 100);
        set({
          positions: state.positions.filter(p => p.id !== id),
          balance: state.balance + entryFee,
        });
        debouncedPush(() => get().pushCloud());
      },

      addPriceAlert: (alert) => {
        set(state => ({
          priceAlerts: [...state.priceAlerts, { ...alert, id: crypto.randomUUID(), triggered: false, createdAt: Date.now() }],
        }));
        debouncedPush(() => get().pushCloud());
      },

      deletePriceAlert: (id) => {
        set(state => ({ priceAlerts: state.priceAlerts.filter(a => a.id !== id) }));
        debouncedPush(() => get().pushCloud());
      },

      editPriceAlert: (id, updates) => {
        set(state => ({
          priceAlerts: state.priceAlerts.map(a => a.id === id ? { ...a, ...updates } : a),
        }));
        debouncedPush(() => get().pushCloud());
      },

      rearmAlert: (id, updates) => {
        set(state => ({
          priceAlerts: state.priceAlerts.map(a => a.id === id ? { ...a, ...updates, triggered: false, triggeredAt: undefined, createdAt: Date.now() } : a),
        }));
        debouncedPush(() => get().pushCloud());
      },

      markAlertTriggered: (id) => {
        set(state => ({
          priceAlerts: state.priceAlerts.map(a => a.id === id ? { ...a, triggered: true, triggeredAt: Date.now() } : a),
        }));
        debouncedPush(() => get().pushCloud());
      },

      dismissAlert: (id) => {
        set(state => ({ priceAlerts: state.priceAlerts.filter(a => a.id !== id) }));
        debouncedPush(() => get().pushCloud());
      },

      addPnlAlert: (alert) => {
        set(state => ({
          pnlAlerts: [...state.pnlAlerts, { ...alert, id: crypto.randomUUID(), triggered: false, createdAt: Date.now() }],
        }));
        debouncedPush(() => get().pushCloud());
      },

      deletePnlAlert: (id) => {
        set(state => ({ pnlAlerts: state.pnlAlerts.filter(a => a.id !== id) }));
        debouncedPush(() => get().pushCloud());
      },

      editPnlAlert: (id, updates) => {
        set(state => ({
          pnlAlerts: state.pnlAlerts.map(a => a.id === id ? { ...a, ...updates } : a),
        }));
        debouncedPush(() => get().pushCloud());
      },

      markPnlAlertTriggered: (id) => {
        set(state => ({
          pnlAlerts: state.pnlAlerts.map(a => a.id === id ? { ...a, triggered: true, triggeredAt: Date.now() } : a),
        }));
        debouncedPush(() => get().pushCloud());
      },

      resetPnlAlert: (id) => {
        set(state => ({
          pnlAlerts: state.pnlAlerts.map(a => a.id === id ? { ...a, triggered: false, triggeredAt: undefined } : a),
        }));
        debouncedPush(() => get().pushCloud());
      },

      dismissPnlAlert: (id) => {
        set(state => ({ pnlAlerts: state.pnlAlerts.filter(a => a.id !== id) }));
        debouncedPush(() => get().pushCloud());
      },

      rearmPnlAlert: (id, updates) => {
        set(state => ({
          pnlAlerts: state.pnlAlerts.map(a => a.id === id ? { ...a, ...updates, triggered: false, triggeredAt: undefined, createdAt: Date.now() } : a),
        }));
        debouncedPush(() => get().pushCloud());
      },

      applySwapFees: () => {
        const state = get();
        if (state.positions.length === 0) return;
        const totalSwapFee = state.positions.reduce((sum, pos) => {
          return sum + pos.size * (state.settings.dailySwapFeePct / 100);
        }, 0);
        set({ balance: state.balance - totalSwapFee });
        debouncedPush(() => get().pushCloud());
      },

      pullCloud: async () => {
        try {
          set({ _syncing: true });
          const pw = localStorage.getItem('breakout-password') || '';
          const res = await fetch('/api/state', {
            headers: pw ? { Authorization: `Bearer ${pw}` } : {},
          });
          if (!res.ok) throw new Error('fetch failed');
          const data = await res.json();
          if (data && typeof data === 'object' && data.balance !== undefined) {
            // Only apply cloud data if it's newer or we have no local data
            const snap: Record<string, unknown> = {};
            for (const key of DATA_KEYS) {
              if (key in data) snap[key] = data[key];
            }
            set(snap as Partial<StoreState>);
          }
        } catch {
          // Silently fail — localStorage is the fallback
        } finally {
          set({ _syncing: false, _lastCloud: Date.now() });
        }
      },

      pushCloud: async () => {
        try {
          const snap = getDataSnapshot(get());
          const pw = localStorage.getItem('breakout-password') || '';
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (pw) headers['Authorization'] = `Bearer ${pw}`;
          await fetch('/api/state', {
            method: 'PUT',
            headers,
            body: JSON.stringify(snap),
          });
          set({ _lastCloud: Date.now() });
        } catch {
          // Silently fail — data is safe in localStorage
        }
      },
    }),
    {
      name: 'breakout-store',
      partialize: (state) => {
        const snap: Record<string, unknown> = {};
        for (const key of DATA_KEYS) {
          snap[key] = state[key];
        }
        return snap;
      },
    }
  )
);
