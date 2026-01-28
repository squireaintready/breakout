import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { PriceMap } from '../hooks/useKrakenPrices';
import { BTC_ETH_ASSETS } from '../utils/constants';
import { priceStep } from '../utils/priceStep';

interface Props {
  prices: PriceMap;
}

export default function OpenPositions({ prices }: Props) {
  const { positions, balance, settings, closePosition, deletePosition, updatePositionStop, updatePositionTP, addPriceAlert } = useStore();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [exitPrice, setExitPrice] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [editingField, setEditingField] = useState<{ id: string; field: 'sl' | 'tp' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sortBy, setSortBy] = useState<'symbol' | 'acct' | 'date' | 'pnl' | 'totp'>('symbol');
  const [alertingId, setAlertingId] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');

  if (positions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 text-center text-slate-400 text-sm">
        No open positions
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

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/New_York' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Positions</h2>
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 text-left border-b border-slate-700">
              <th className="pb-2 pr-3 font-medium">Symbol</th>
              <th className="pb-2 pr-3 font-medium">Side</th>
              <th className="pb-2 pr-3 font-medium text-right">Total Value</th>
              <th className="pb-2 pr-3 font-medium text-right">% Acct</th>
              <th className="pb-2 pr-3 font-medium text-right">Lot Size</th>
              <th className="pb-2 pr-3 font-medium text-right">Fill Price</th>
              <th className="pb-2 pr-3 font-medium text-right">Stop Loss</th>
              <th className="pb-2 pr-3 font-medium text-right">Take Profit</th>
              <th className="pb-2 pr-3 font-medium text-right">Current Price</th>
              <th className="pb-2 pr-3 font-medium text-right">P&L</th>
              <th className="pb-2 pr-3 font-medium text-right">To TP</th>
              <th className="pb-2 font-medium text-right">Date & Time</th>
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
            }).map(({ pos, currentPrice, pnl, sizeQty, acctPct, distToTP }, i, sorted) => {
              const prevAsset = i > 0 ? sorted[i - 1].pos.asset : null;
              const isNewGroup = sortBy === 'symbol' && prevAsset !== null && prevAsset !== pos.asset;
              return (
              <tr key={pos.id} className={`hover:bg-slate-700/30 ${isNewGroup ? 'border-t border-slate-600' : 'border-b border-slate-700/50'}`}>
                <td className="py-2 pr-3 font-bold text-slate-200">{pos.asset}</td>
                <td className="py-2 pr-3">
                  <span className={pos.side === 'long' ? 'text-green-400' : 'text-red-400'}>
                    {pos.side === 'long' ? 'Buy' : 'Sell'}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-300">${pos.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="py-2 pr-3 text-right font-mono text-slate-400">{acctPct.toFixed(1)}%</td>
                <td className="py-2 pr-3 text-right font-mono text-slate-300">{fmtQty(sizeQty)}</td>
                <td className="py-2 pr-3 text-right font-mono text-slate-300">{fmtPrice(pos.entryPrice)}</td>

                {/* Stop Loss - click to edit */}
                <td className="py-2 pr-3 text-right font-mono">
                  {editingField?.id === pos.id && editingField.field === 'sl' ? (
                    <input type="number" value={editValue} autoFocus step={priceStep(editValue)}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
                      className="w-20 bg-slate-700 rounded px-1 py-0.5 text-xs font-mono text-right" />
                  ) : (
                    <span
                      className="cursor-pointer hover:text-blue-400 text-slate-300"
                      onClick={() => { setEditingField({ id: pos.id, field: 'sl' }); setEditValue(pos.stopLoss?.toString() ?? ''); }}>
                      {pos.stopLoss != null ? fmtPrice(pos.stopLoss) : <span className="text-slate-600">&mdash;</span>}
                    </span>
                  )}
                </td>

                {/* Take Profit - click to edit */}
                <td className="py-2 pr-3 text-right font-mono">
                  {editingField?.id === pos.id && editingField.field === 'tp' ? (
                    <input type="number" value={editValue} autoFocus step={priceStep(editValue)}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
                      className="w-20 bg-slate-700 rounded px-1 py-0.5 text-xs font-mono text-right" />
                  ) : (
                    <span
                      className="cursor-pointer hover:text-blue-400 text-slate-300"
                      onClick={() => { setEditingField({ id: pos.id, field: 'tp' }); setEditValue(pos.takeProfit?.toString() ?? ''); }}>
                      {pos.takeProfit != null ? fmtPrice(pos.takeProfit) : <span className="text-slate-600">&mdash;</span>}
                    </span>
                  )}
                </td>

                <td className={`py-2 pr-3 text-right font-mono ${
                  currentPrice > pos.entryPrice
                    ? (pos.side === 'long' ? 'text-green-400' : 'text-red-400')
                    : currentPrice < pos.entryPrice
                      ? (pos.side === 'long' ? 'text-red-400' : 'text-green-400')
                      : 'text-slate-300'
                }`}>
                  {fmtPrice(currentPrice)}
                </td>

                <td className={`py-2 pr-3 text-right font-mono font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '' : '-'}{pnl >= 0 ? '' : ''}{Math.abs(pnl).toFixed(2)}
                </td>

                <td className="py-2 pr-3 text-right font-mono text-slate-400">
                  {distToTP != null ? `${distToTP.toFixed(2)}%` : <span className="text-slate-600">&mdash;</span>}
                </td>

                <td className="py-2 pr-3 text-right font-mono text-slate-400 whitespace-nowrap">
                  {fmtDate(pos.openedAt)}
                </td>

                <td className="py-2 text-right">
                  {closingId === pos.id ? (
                    <div className="flex items-center gap-1 justify-end">
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
                    <div className="flex items-center gap-1 justify-end">
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setAlertingId(pos.id); setAlertPrice(String(currentPrice)); setAlertDir('below'); }}
                        className="text-slate-500 hover:text-yellow-400 text-sm leading-none"
                        title="Quick alert">&#128276;</button>
                      <button onClick={() => { setClosingId(pos.id); setExitPrice(''); }}
                        className="px-2 py-0.5 bg-red-600/80 text-white rounded text-xs hover:bg-red-500">
                        Close
                      </button>
                      <button onClick={() => { if (confirm('Delete this position? Entry fee will be refunded.')) deletePosition(pos.id); }}
                        className="text-slate-500 hover:text-red-400 text-sm leading-none"
                        title="Delete position">&times;</button>
                    </div>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {/* Aggregate stats + projections */}
      <div className="mt-3 bg-slate-900 rounded-lg p-3 text-xs space-y-2">
        <div className="grid grid-cols-4 gap-2">
          <div>
            <div className="text-slate-500">Exposure</div>
            <div className="font-mono">${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div>
            <div className="text-slate-500">Risk @ Stops</div>
            <div className="font-mono text-red-400">${totalRiskAtStops.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-slate-500">Unrealized P&L</div>
            <div className={`font-mono ${totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Positions</div>
            <div className="font-mono">{positions.length}</div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-2">
          <div className="text-slate-500 font-semibold mb-1">Projections</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-slate-500">If all stops hit</div>
              <div className="font-mono text-red-400">
                {totalPnlIfAllSLHit < 0 ? '' : '+'}{totalPnlIfAllSLHit.toFixed(2)}
                <span className="text-slate-500 ml-1">
                  ({balance > 0 ? ((totalPnlIfAllSLHit / balance) * 100).toFixed(2) : '0'}%)
                </span>
              </div>
            </div>
            <div>
              <div className="text-slate-500">If all TPs hit</div>
              <div className="font-mono text-green-400">
                {totalPnlIfAllTPHit > 0 ? '+' : ''}{totalPnlIfAllTPHit.toFixed(2)}
                <span className="text-slate-500 ml-1">
                  ({balance > 0 ? ((totalPnlIfAllTPHit / balance) * 100).toFixed(2) : '0'}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
