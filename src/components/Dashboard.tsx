import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { calcDailyDrawdownPct, calcTotalDrawdownPct, calcRiskIfAllStopsHit } from '../utils/drawdown';
import DrawdownBars from './DrawdownBars';
import PositionSizer from './PositionSizer';
import OpenPositions from './OpenPositions';
import EquityChart from './EquityChart';
import PriceAlerts from './PriceAlerts';
import type { PriceMap } from '../hooks/useKrakenPrices';

interface Props {
  prices: PriceMap;
}

export default function Dashboard({ prices }: Props) {
  const { balance, dayStartBalance, highWaterMark, settings, positions, realizedPnl, pnlAlerts, addPnlAlert } = useStore();
  const dailyDD = calcDailyDrawdownPct(balance, dayStartBalance);
  const totalDD = calcTotalDrawdownPct(balance, highWaterMark);
  const riskAtStops = calcRiskIfAllStopsHit(positions, balance, settings.tradingFeePct);

  // Unrealized P&L
  const unrealizedPnl = positions.reduce((sum, pos) => {
    const currentPrice = prices[pos.asset] || pos.entryPrice;
    const dir = pos.side === 'long' ? 1 : -1;
    return sum + ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.size * dir;
  }, 0);

  const totalPnlAlerts = pnlAlerts.length;

  // Quick-add P&L alert
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaTarget, setQaTarget] = useState('');
  const [qaDir, setQaDir] = useState<'above' | 'below'>('below');
  const [qaNote, setQaNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleQuickAdd = () => {
    if (showQuickAdd) { setShowQuickAdd(false); return; }
    setQaTarget(String(Math.round(unrealizedPnl)));
    setQaDir('below');
    setQaNote('');
    setShowQuickAdd(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const submitQuickAdd = () => {
    const val = parseFloat(qaTarget);
    if (isNaN(val)) return;
    addPnlAlert({ targetPnl: val, direction: qaDir, note: qaNote });
    setShowQuickAdd(false);
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-4">
      {/* Balance card */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="text-slate-400 text-xs">Current Balance</div>
        <div className="text-2xl font-bold font-mono">${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        <div className="flex gap-4 mt-1 text-xs">
          <span className={`font-mono ${realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Realized: {realizedPnl >= 0 ? '+' : ''}{realizedPnl.toFixed(2)}
          </span>
          <span className={`font-mono ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Unrealized: {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
          </span>
          <button onClick={toggleQuickAdd}
            className={`relative ${totalPnlAlerts > 0 ? 'text-yellow-400' : 'text-slate-500'} hover:text-yellow-400 transition-colors`}
            title="Quick-add P&L alert">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 2a6 6 0 00-6 6c0 1.887-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.91 32.91 0 003.256.508 3.5 3.5 0 006.972 0 32.903 32.903 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6zm0 14.5a2 2 0 01-1.95-1.557 33.146 33.146 0 003.9 0A2 2 0 0110 16.5z" clipRule="evenodd" />
            </svg>
            {totalPnlAlerts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {totalPnlAlerts}
              </span>
            )}
          </button>
        </div>

        {/* Quick-add P&L alert */}
        {showQuickAdd && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <button onClick={() => setQaDir(d => d === 'above' ? 'below' : 'above')}
              className={`px-1.5 py-0.5 rounded ${qaDir === 'above' ? 'bg-green-700 text-green-300' : 'bg-red-700 text-red-300'}`}>
              {qaDir === 'above' ? '↑' : '↓'}
            </button>
            <input ref={inputRef} type="number" value={qaTarget} onChange={e => setQaTarget(e.target.value)}
              placeholder="Target $"
              className="w-24 bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono"
              onKeyDown={e => {
                if (e.key === 'Enter') submitQuickAdd();
                if (e.key === 'Escape') setShowQuickAdd(false);
              }} />
            <input type="text" value={qaNote} onChange={e => setQaNote(e.target.value)}
              placeholder="Note"
              className="w-20 bg-slate-700 rounded px-1.5 py-0.5 text-xs"
              onKeyDown={e => {
                if (e.key === 'Enter') submitQuickAdd();
                if (e.key === 'Escape') setShowQuickAdd(false);
              }} />
            <button onClick={submitQuickAdd}
              className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-500">Add</button>
            <button onClick={() => setShowQuickAdd(false)}
              className="text-slate-400 hover:text-slate-200 text-xs">X</button>
          </div>
        )}

        <div className="mt-3">
          <DrawdownBars label="Daily" currentPct={dailyDD} softLimit={settings.dailySoftDrawdownPct} hardLimit={settings.dailyHardDrawdownPct} />
          <DrawdownBars label="Total" currentPct={totalDD} hardLimit={settings.totalDrawdownPct} />
        </div>

        <div className="mt-2 text-xs text-slate-400">
          Aggregate risk (all stops): <span className={`font-mono font-bold ${riskAtStops > settings.dailySoftDrawdownPct ? 'text-red-400' : 'text-green-400'}`}>
            {riskAtStops.toFixed(2)}%
          </span>
        </div>
      </div>

      <PositionSizer prices={prices} />
      <OpenPositions prices={prices} />
      <PriceAlerts prices={prices} unrealizedPnl={unrealizedPnl} />
      <EquityChart />
    </div>
  );
}
