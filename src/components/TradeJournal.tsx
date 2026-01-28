import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';

export default function TradeJournal() {
  const { trades, editTrade, deleteTrade, balance } = useStore();
  const [filter, setFilter] = useState<'all' | 'win' | 'loss' | 'favorites'>('all');
  const [assetFilter, setAssetFilter] = useState('');
  const [starOnly, setStarOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editExit, setEditExit] = useState('');
  const [showFavPanel, setShowFavPanel] = useState(false);

  const filtered = useMemo(() => {
    let t = [...trades].reverse();
    if (filter === 'win') t = t.filter(x => x.pnl > 0);
    if (filter === 'loss') t = t.filter(x => x.pnl <= 0);
    if (filter === 'favorites') t = t.filter(x => x.starred);
    if (starOnly) t = t.filter(x => x.starred);
    if (assetFilter) t = t.filter(x => x.asset === assetFilter);
    return t;
  }, [trades, filter, assetFilter, starOnly]);

  const starred = useMemo(() => trades.filter(t => t.starred).reverse(), [trades]);

  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const winRate = (wins.length / trades.length) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const totalFees = trades.reduce((s, t) => s + t.fees, 0);
    const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
    return { winRate, avgWin, avgLoss, avgRR, profitFactor, total: trades.length, totalWins: wins.length, totalLosses: losses.length, netPnl, totalFees };
  }, [trades]);

  const uniqueAssets = [...new Set(trades.map(t => t.asset))];

  const saveEdit = (tradeId: string) => {
    const updates: Parameters<typeof editTrade>[1] = { notes: editNotes };
    const ep = parseFloat(editExit);
    if (!isNaN(ep) && ep > 0) updates.exitPrice = ep;
    editTrade(tradeId, updates);
    setEditingId(null);
  };

  const renderTradeCard = (trade: typeof trades[0], compact = false) => (
    <div key={trade.id} className="bg-slate-800 rounded-lg p-3 text-sm">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={() => editTrade(trade.id, { starred: !trade.starred })}
            className={`text-sm ${trade.starred ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}>
            {trade.starred ? '★' : '☆'}
          </button>
          <span className="font-bold">{trade.asset}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${trade.side === 'long' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
            {trade.side.toUpperCase()}
          </span>
        </div>
        <span className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs text-slate-400 mt-1">
        <div>Entry: <span className="font-mono text-slate-300">${trade.entryPrice.toLocaleString()}</span></div>
        <div>Exit: <span className="font-mono text-slate-300">${trade.exitPrice.toLocaleString()}</span></div>
        <div>Amount: <span className="font-mono text-slate-300">${trade.size.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({(trade.size / balance * 100).toFixed(1)}%)</span></div>
        <div>Lot Size: <span className="font-mono text-slate-300">{(trade.size / trade.entryPrice).toFixed(4)}</span></div>
        <div>Fees: <span className="font-mono text-orange-400">${trade.fees.toFixed(2)}</span></div>
        <div className="col-span-2">{new Date(trade.closedAt).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</div>
      </div>
      {editingId === trade.id ? (
        <div className="mt-2 flex gap-1 items-center">
          <div className="text-xs text-slate-400">Exit:</div>
          <input type="number" value={editExit} onChange={e => setEditExit(e.target.value)}
            className="w-24 bg-slate-700 rounded px-2 py-1 text-xs font-mono" placeholder="Exit price"
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit(trade.id);
              if (e.key === 'Escape') setEditingId(null);
            }} />
          <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
            className="flex-1 bg-slate-700 rounded px-2 py-1 text-xs" placeholder="Notes..."
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit(trade.id);
              if (e.key === 'Escape') setEditingId(null);
            }} />
          <button onClick={() => saveEdit(trade.id)}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Save</button>
        </div>
      ) : (
        <div className="mt-1 flex justify-between items-center">
          <span className="text-xs text-slate-500 italic">{trade.notes || 'No notes'}</span>
          <div className="flex gap-2">
            <button onClick={() => { setEditingId(trade.id); setEditNotes(trade.notes); setEditExit(String(trade.exitPrice)); }}
              className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
            {!compact && (
              <button onClick={() => { if (confirm('Delete this trade? Balance will be adjusted.')) deleteTrade(trade.id); }}
                className="text-xs text-red-400 hover:text-red-300">Delete</button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Trade Journal</h2>
        {starred.length > 0 && (
          <button onClick={() => setShowFavPanel(!showFavPanel)}
            className={`text-sm px-3 py-1 rounded ${showFavPanel ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-yellow-400'}`}>
            ★ Favorites ({starred.length})
          </button>
        )}
      </div>

      {showFavPanel && starred.length > 0 && (
        <div className="bg-slate-900 border border-yellow-600/30 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-yellow-400">★ Favorites</h3>
          {starred.map(trade => renderTradeCard(trade, true))}
        </div>
      )}

      {stats && (
        <div className="bg-slate-800 rounded-xl p-4 grid grid-cols-3 sm:grid-cols-4 gap-3 text-sm">
          <div><div className="text-slate-400 text-xs">Trades</div><div className="font-mono font-bold">{stats.total}</div></div>
          <div><div className="text-slate-400 text-xs">Total Wins</div><div className="font-mono text-green-400">{stats.totalWins}</div></div>
          <div><div className="text-slate-400 text-xs">Total Losses</div><div className="font-mono text-red-400">{stats.totalLosses}</div></div>
          <div><div className="text-slate-400 text-xs">Net P&L</div><div className={`font-mono font-bold ${stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.netPnl >= 0 ? '+' : ''}${stats.netPnl.toFixed(2)}</div></div>
          <div><div className="text-slate-400 text-xs">Win Rate</div><div className="font-mono font-bold">{stats.winRate.toFixed(1)}%</div></div>
          <div><div className="text-slate-400 text-xs">Avg R:R</div><div className="font-mono font-bold">{stats.avgRR.toFixed(2)}</div></div>
          <div><div className="text-slate-400 text-xs">Profit Factor</div><div className="font-mono font-bold">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</div></div>
          <div><div className="text-slate-400 text-xs">Avg Win</div><div className="font-mono text-green-400">${stats.avgWin.toFixed(2)}</div></div>
          <div><div className="text-slate-400 text-xs">Avg Loss</div><div className="font-mono text-red-400">${stats.avgLoss.toFixed(2)}</div></div>
          <div><div className="text-slate-400 text-xs">Total Fees</div><div className="font-mono text-orange-400">${stats.totalFees.toFixed(2)}</div></div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {(['all', 'win', 'loss', 'favorites'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm ${filter === f ? (f === 'favorites' ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white') : 'bg-slate-700 text-slate-400'}`}>
            {f === 'all' ? 'All' : f === 'win' ? 'Wins' : f === 'loss' ? 'Losses' : '★ Favorites'}
          </button>
        ))}
        <button onClick={() => setStarOnly(!starOnly)}
          className={`px-2 py-1 rounded text-sm ${starOnly ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-500'}`}
          title="Toggle starred only">
          ★
        </button>
        <select value={assetFilter} onChange={e => setAssetFilter(e.target.value)}
          className="bg-slate-700 rounded px-2 py-1 text-sm">
          <option value="">All Assets</option>
          {uniqueAssets.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-8">No trades yet</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(trade => renderTradeCard(trade))}
        </div>
      )}
    </div>
  );
}
