import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { PriceMap } from '../hooks/useKrakenPrices';
import { BTC_ETH_ASSETS } from '../utils/constants';
import { priceStep } from '../utils/priceStep';

interface Props {
  prices: PriceMap;
  onAddPosition?: () => void;
}

export default function OpenPositions({ prices, onAddPosition }: Props) {
  const { positions, balance, dayStartBalance, settings, trades, closePosition, deletePosition, updatePositionStop, updatePositionTP, addPriceAlert, reopenTrade } = useStore();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [exitPrice, setExitPrice] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [editingField, setEditingField] = useState<{ id: string; field: 'sl' | 'tp' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sortBy, setSortBy] = useState<'symbol' | 'acct' | 'date' | 'pnl' | 'totp'>('symbol');
  const [alertingId, setAlertingId] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');
  const [slCloseBanner, setSlCloseBanner] = useState<{ asset: string; side: string } | null>(null);

  // Listen for auto-close events from SL trigger
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSlCloseBanner({ asset: detail.asset, side: detail.side });
      const timer = setTimeout(() => setSlCloseBanner(null), 30_000);
      return () => clearTimeout(timer);
    };
    window.addEventListener('sl-auto-close', handler);
    return () => window.removeEventListener('sl-auto-close', handler);
  }, []);

  const handleUndoSlClose = useCallback(() => {
    // Find the most recent auto-closed trade
    const autoTrade = [...trades].reverse().find(t => t.notes === 'Auto-closed: SL hit');
    if (autoTrade) {
      reopenTrade(autoTrade.id);
    }
    setSlCloseBanner(null);
  }, [trades, reopenTrade]);

  if (positions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 text-center text-slate-400 text-sm">
        No open positions
        {onAddPosition && (
          <button onClick={onAddPosition}
            className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-500">
            + Add
          </button>
        )}
      </div>
    );
  }

  const feePct = settings.tradingFeePct / 100;

  let totalPnlIfAllSLHit = 0;
  let totalPnlIfAllTPHit = 0;
  let totalExposure = 0;
  let totalRiskAtStops = 0;
  let totalUnrealizedPnl = 0;

  const positionRows = positions.map(pos => {
    const currentPrice = prices[pos.asset] || pos.entryPrice;
    const dir = pos.side === 'long' ? 1 : -1;
    const pnl = ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.size * dir;
    totalUnrealizedPnl += pnl;
    totalExposure += pos.size;

    const leverage = pos.size / balance;
    const maxLev = BTC_ETH_ASSETS.includes(pos.asset) ? settings.btcEthLeverage : settings.altLeverage;
    const sizeQty = pos.size / pos.entryPrice;
    const acctPct = balance > 0 ? (pos.size / balance / 2) * 100 : 0;

    const riskAmt = pos.stopLoss
      ? (Math.abs(pos.entryPrice - pos.stopLoss) / pos.entryPrice) * pos.size
      : 0;
    totalRiskAtStops += riskAmt + (pos.stopLoss ? pos.size * feePct : 0);

    const rewardAmt = pos.takeProfit
      ? (Math.abs(pos.takeProfit - pos.entryPrice) / pos.entryPrice) * pos.size
      : 0;

    if (pos.stopLoss) totalPnlIfAllSLHit += -riskAmt - pos.size * feePct;
    if (pos.takeProfit) totalPnlIfAllTPHit += rewardAmt - pos.size * feePct;

    const distToTP = pos.takeProfit && currentPrice > 0
      ? ((pos.takeProfit - currentPrice) / currentPrice) * 100 * dir
      : null;

    return { pos, currentPrice, pnl, leverage, maxLev, riskAmt, rewardAmt, sizeQty, acctPct, distToTP };
  });

  const handleClose = (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    const price = parseFloat(exitPrice) || prices[pos.asset] || 0;
    if (price <= 0) return;
    closePosition(id, price, closeNotes);
    setClosingId(null);
    setExitPrice('');
    setCloseNotes('');
  };

  const commitEdit = () => {
    if (!editingField) return;
    const val = editValue.trim() ? parseFloat(editValue) : null;
    if (editingField.field === 'sl') updatePositionStop(editingField.id, val);
    else updatePositionTP(editingField.id, val);
    setEditingField(null);
    setEditValue('');
  };

  const fmtPrice = (v: number) => {
    if (v >= 1000) return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (v >= 1) return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return v.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 5 });
  };

  const fmtQty = (v: number) => {
    return v % 1 === 0
      ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : v.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const fmtDateOnly = (ts: number) => {
    return new Date(ts).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/New_York' });
  };
  const fmtTimeOnly = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Positions</h2>
          {onAddPosition && (
            <button onClick={onAddPosition}
              className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-sm leading-none hover:bg-blue-500"
              title="Add position">+</button>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500">Sort:</span>
          {([['symbol', 'Symbol'], ['acct', '% Acct'], ['date', 'Date'], ['pnl', 'P&L'], ['totp', 'To TP']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`px-2 py-0.5 rounded ${sortBy === key ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {slCloseBanner && (
        <div className="mb-3 bg-red-900/50 border border-red-700 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
          <span>SL auto-closed <b>{slCloseBanner.asset}</b> {slCloseBanner.side.toUpperCase()}</span>
          <button onClick={handleUndoSlClose}
            className="px-2 py-0.5 bg-yellow-600 text-white rounded hover:bg-yellow-500 font-semibold">
            Undo
          </button>
        </div>
      )}

      {/* Table */}
      <div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left border-b border-slate-700">
              <th className="pb-2 pr-1 font-medium">Sym</th>
              <th className="pb-2 pr-1 font-medium text-right">Value</th>
              <th className="pb-2 pr-1 font-medium text-right">Lot</th>
              <th className="pb-2 pr-1 font-medium text-right">Fill</th>
              <th className="pb-2 pr-1 font-medium text-right">SL</th>
              <th className="pb-2 pr-1 font-medium text-right">TP</th>
              <th className="pb-2 pr-1 font-medium text-right">Price</th>
              <th className="pb-2 pr-1 font-medium text-right">To TP</th>
              <th className="pb-2 pr-1 font-medium text-right">Date</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {[...positionRows].sort((a, b) => {
              if (sortBy === 'symbol') return a.pos.asset.localeCompare(b.pos.asset);
              if (sortBy === 'acct') return b.acctPct - a.acctPct;
              if (sortBy === 'date') return b.pos.openedAt - a.pos.openedAt;
              if (sortBy === 'pnl') return b.pnl - a.pnl;
              if (sortBy === 'totp') return (a.distToTP ?? Infinity) - (b.distToTP ?? Infinity);
              return 0;
            }).map(({ pos, currentPrice, pnl, riskAmt, rewardAmt, sizeQty, acctPct, distToTP }, i, sorted) => {
              const prevAsset = i > 0 ? sorted[i - 1].pos.asset : null;
              const isNewGroup = sortBy === 'symbol' && prevAsset !== null && prevAsset !== pos.asset;
              const dir = pos.side === 'long' ? 1 : -1;
              const fillPctRaw = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
              const fillPct = fillPctRaw * dir;
              return (
              <React.Fragment key={pos.id}>
              {/* Row 1: Primary */}
              <tr className={`hover:bg-slate-700/30 ${isNewGroup ? 'border-t border-slate-600' : ''}`}>
                <td className="pt-2 pb-0 pr-1 font-bold text-slate-200 truncate">{pos.asset}</td>
                <td className="pt-2 pb-0 pr-1 text-right font-mono text-slate-300">${pos.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="pt-2 pb-0 pr-1 text-right font-mono text-slate-300">{fmtQty(sizeQty)}</td>
                <td className="pt-2 pb-0 pr-1 text-right font-mono text-slate-300">{fmtPrice(pos.entryPrice)}</td>

                {/* Stop Loss - click to edit */}
                <td className="pt-2 pb-0 pr-1 text-right font-mono">
                  {editingField?.id === pos.id && editingField.field === 'sl' ? (
                    <input type="number" value={editValue} autoFocus step={priceStep(editValue)}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
                      className="w-full bg-slate-700 rounded px-1 py-0.5 text-xs font-mono text-center" />
                  ) : (
                    <span
                      className="cursor-pointer hover:text-blue-400 text-slate-300"
                      onClick={() => { setEditingField({ id: pos.id, field: 'sl' }); setEditValue(pos.stopLoss?.toString() ?? ''); }}>
                      {pos.stopLoss != null ? fmtPrice(pos.stopLoss) : <span className="text-slate-600">&mdash;</span>}
                    </span>
                  )}
                </td>

                {/* Take Profit - click to edit */}
                <td className="pt-2 pb-0 pr-1 text-right font-mono">
                  {editingField?.id === pos.id && editingField.field === 'tp' ? (
                    <input type="number" value={editValue} autoFocus step={priceStep(editValue)}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
                      className="w-full bg-slate-700 rounded px-1 py-0.5 text-xs font-mono text-center" />
                  ) : (
                    <span
                      className="cursor-pointer hover:text-blue-400 text-slate-300"
                      onClick={() => { setEditingField({ id: pos.id, field: 'tp' }); setEditValue(pos.takeProfit?.toString() ?? ''); }}>
                      {pos.takeProfit != null ? fmtPrice(pos.takeProfit) : <span className="text-slate-600">&mdash;</span>}
                    </span>
                  )}
                </td>

                <td className={`pt-2 pb-0 pr-1 text-right font-mono ${
                  currentPrice > pos.entryPrice
                    ? (pos.side === 'long' ? 'text-green-400' : 'text-red-400')
                    : currentPrice < pos.entryPrice
                      ? (pos.side === 'long' ? 'text-red-400' : 'text-green-400')
                      : 'text-slate-300'
                }`}>
                  {fmtPrice(currentPrice)}
                </td>

                <td className="pt-2 pb-0 pr-1 text-right font-mono text-slate-400">
                  {distToTP != null ? `${distToTP.toFixed(2)}%` : <span className="text-slate-600">&mdash;</span>}
                </td>

                <td className="pt-2 pb-0 pr-1 text-right font-mono text-slate-400 whitespace-nowrap">
                  {fmtDateOnly(pos.openedAt)}
                </td>

                <td className="pt-2 pb-0 text-center align-top" rowSpan={2}>
                  {closingId === pos.id ? (
                    <div className="flex items-center gap-1 justify-center">
                      <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)}
                        placeholder={`${currentPrice}`} autoFocus step={priceStep(exitPrice)}
                        className="w-20 bg-slate-700 rounded px-1 py-0.5 text-xs font-mono"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleClose(pos.id);
                          if (e.key === 'Escape') setClosingId(null);
                        }} />
                      <input type="text" value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                        placeholder="Notes"
                        className="w-16 bg-slate-700 rounded px-1 py-0.5 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleClose(pos.id);
                          if (e.key === 'Escape') setClosingId(null);
                        }} />
                      <button onClick={() => handleClose(pos.id)}
                        className="px-1.5 py-0.5 bg-red-600 text-white rounded text-xs">OK</button>
                      <button onClick={() => setClosingId(null)}
                        className="text-slate-400 hover:text-slate-200 text-xs">X</button>
                    </div>
                  ) : alertingId === pos.id ? (
                    <div className="flex items-center gap-1 justify-center">
                      <button onClick={() => setAlertDir(d => d === 'above' ? 'below' : 'above')}
                        className={`px-1.5 py-0.5 rounded text-xs ${alertDir === 'above' ? 'bg-green-700 text-green-300' : 'bg-red-700 text-red-300'}`}>
                        {alertDir === 'above' ? '↑' : '↓'}
                      </button>
                      <input type="number" value={alertPrice} onChange={e => setAlertPrice(e.target.value)}
                        placeholder={`${currentPrice}`} autoFocus step={priceStep(alertPrice)}
                        className="w-20 bg-slate-700 rounded px-1 py-0.5 text-xs font-mono"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const p = parseFloat(alertPrice);
                            if (p > 0) { addPriceAlert({ asset: pos.asset, targetPrice: p, direction: alertDir, note: '' }); setAlertingId(null); setAlertPrice(''); }
                          }
                          if (e.key === 'Escape') setAlertingId(null);
                        }} />
                      <button onClick={() => {
                        const p = parseFloat(alertPrice);
                        if (p > 0) { addPriceAlert({ asset: pos.asset, targetPrice: p, direction: alertDir, note: '' }); setAlertingId(null); setAlertPrice(''); }
                      }} className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs">OK</button>
                      <button onClick={() => setAlertingId(null)}
                        className="text-slate-400 hover:text-slate-200 text-xs">X</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 justify-center">
                      <button onClick={() => { setAlertingId(pos.id); setAlertPrice(String(currentPrice)); setAlertDir('below'); }}
                        className="text-slate-500 hover:text-yellow-400 text-xs leading-none"
                        title="Quick alert">&#128276;</button>
                      <button onClick={() => { setClosingId(pos.id); setExitPrice(''); }}
                        className="px-1.5 py-px bg-red-600/80 text-white rounded text-xs hover:bg-red-500">
                        Close
                      </button>
                      <button onClick={() => { if (confirm('Delete this position? Entry fee will be refunded.')) deletePosition(pos.id); }}
                        className="text-slate-500 hover:text-red-400 text-xs leading-none"
                        title="Delete position">&times;</button>
                    </div>
                  )}
                </td>
              </tr>
              {/* Row 2: Secondary values per column */}
              <tr className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="pb-2 pt-0 pr-1 text-[10px] font-mono">
                  <span className={pos.side === 'long' ? 'text-green-400' : 'text-red-400'}>{pos.side === 'long' ? 'Buy' : 'Sell'}</span>
                </td>
                <td className="pb-2 pt-0 pr-1 text-right text-[10px] font-mono text-slate-500">${(pos.size / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="pb-2 pt-0 pr-1 text-right text-[10px] font-mono text-slate-600"></td>
                <td className="pb-2 pt-0 pr-1 text-right text-[10px] font-mono text-slate-500">{acctPct.toFixed(1)}%</td>
                <td className="pb-2 pt-0 pr-1 text-right text-[10px] font-mono text-red-400">
                  {pos.stopLoss != null ? `-$${(riskAmt + pos.size * feePct).toFixed(0)}` : ''}
                </td>
                <td className="pb-2 pt-0 pr-1 text-right text-[10px] font-mono text-green-400">
                  {pos.takeProfit != null ? `+$${(rewardAmt - pos.size * feePct).toFixed(0)}` : ''}
                </td>
                <td className={`pb-2 pt-0 pr-1 text-right text-[10px] font-mono font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(0)}
                </td>
                <td className={`pb-2 pt-0 pr-1 text-right text-[10px] font-mono ${fillPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fillPct >= 0 ? '+' : ''}{fillPct.toFixed(2)}%
                </td>
                <td className="pb-2 pt-0 pr-1 text-right text-[10px] font-mono text-slate-500 whitespace-nowrap">
                  {fmtTimeOnly(pos.openedAt)}
                </td>
                {/* Actions cell is rowSpan=2 from row 1 */}
              </tr>
              </React.Fragment>
            );
            })}
          </tbody>
        </table>
      </div>

      {/* Aggregate stats + projections */}
      <div className="mt-3 bg-slate-900 rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/80 rounded-lg px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Margin Used</div>
            <div className="font-mono text-lg font-bold text-slate-100">${(totalExposure / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-[10px] font-mono text-slate-500">{balance > 0 ? ((totalExposure / 2 / balance) * 100).toFixed(1) : '0'}% of balance</div>
          </div>
          <div className="bg-slate-800/80 rounded-lg px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Exposure</div>
            <div className="font-mono text-lg font-bold text-slate-100">${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-[10px] font-mono text-slate-500">{positions.length} position{positions.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-slate-800/80 rounded-lg px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Unrealized P&L</div>
            <div className={`font-mono text-lg font-bold ${totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}${Math.abs(totalUnrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className={`text-[10px] font-mono ${totalUnrealizedPnl >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
              {balance > 0 ? `${totalUnrealizedPnl >= 0 ? '+' : ''}${((totalUnrealizedPnl / balance) * 100).toFixed(2)}%` : '0%'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(() => {
            const maxLoss = dayStartBalance * 0.03;
            const unrealizedLoss = totalUnrealizedPnl < 0 ? Math.abs(totalUnrealizedPnl) : 0;
            const remaining = maxLoss - unrealizedLoss;
            const lossPct = dayStartBalance > 0 ? (unrealizedLoss / dayStartBalance) * 100 : 0;
            const color = lossPct >= 2 ? 'text-red-400' : lossPct >= 1 ? 'text-yellow-400' : 'text-green-400';
            const subColor = lossPct >= 2 ? 'text-red-400/60' : lossPct >= 1 ? 'text-yellow-400/60' : 'text-green-400/60';
            return (
              <div className="bg-slate-800/80 rounded-lg px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Max Drawdown</div>
                <div className={`font-mono text-lg font-bold ${color}`}>${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className={`text-[10px] font-mono ${subColor}`}>{lossPct.toFixed(2)}% of 3% used</div>
              </div>
            );
          })()}
          <div className="bg-slate-800/80 rounded-lg px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Avg To TP</div>
            <div className="font-mono text-lg font-bold text-slate-200">
              {(() => {
                const valid = positionRows.filter(r => r.distToTP != null);
                if (valid.length === 0) return '—';
                const totalSize = valid.reduce((s, r) => s + r.pos.size, 0);
                if (totalSize === 0) return '—';
                const weighted = valid.reduce((s, r) => s + r.distToTP! * r.pos.size, 0) / totalSize;
                return `${weighted.toFixed(2)}%`;
              })()}
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-lg px-3 py-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">All SL</div>
              <div className="font-mono text-sm font-bold text-red-400">
                {totalPnlIfAllSLHit < 0 ? '-' : '+'}${Math.abs(totalPnlIfAllSLHit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] font-mono text-red-400/60">
                {balance > 0 ? ((totalPnlIfAllSLHit / balance) * 100).toFixed(1) : '0'}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">All TP</div>
              <div className="font-mono text-sm font-bold text-green-400">
                {totalPnlIfAllTPHit > 0 ? '+' : ''}${Math.abs(totalPnlIfAllTPHit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] font-mono text-green-400/60">
                {balance > 0 ? `+${((totalPnlIfAllTPHit / balance) * 100).toFixed(1)}` : '0'}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
