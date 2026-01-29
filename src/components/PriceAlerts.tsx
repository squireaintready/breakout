import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { PriceAlert, PnlAlert } from '../store/useStore';
import type { PriceMap } from '../hooks/useKrakenPrices';
import AssetPicker from './AssetPicker';
import { priceStep } from '../utils/priceStep';

interface Props {
  prices: PriceMap;
  unrealizedPnl?: number;
}

export default function PriceAlerts({ prices, unrealizedPnl = 0 }: Props) {
  const { priceAlerts, addPriceAlert, deletePriceAlert, editPriceAlert, rearmAlert, dismissAlert,
    pnlAlerts, addPnlAlert, deletePnlAlert, editPnlAlert, dismissPnlAlert, rearmPnlAlert } = useStore();
  const [asset, setAsset] = useState('BTC');
  const [targetPrice, setTargetPrice] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDir, setEditDir] = useState<'above' | 'below'>('above');
  const [editNote, setEditNote] = useState('');
  const [rearmId, setRearmId] = useState<string | null>(null);
  const [rearmPrice, setRearmPrice] = useState('');
  const [rearmDir, setRearmDir] = useState<'above' | 'below'>('below');
  const [confirmClear, setConfirmClear] = useState(false);

  // P&L alert state
  const [showPnlForm, setShowPnlForm] = useState(false);
  const [pnlTarget, setPnlTarget] = useState('');
  const [pnlDir, setPnlDir] = useState<'above' | 'below'>('above');
  const [pnlNote, setPnlNote] = useState('');
  const [editingPnlId, setEditingPnlId] = useState<string | null>(null);
  const [editPnlTarget, setEditPnlTarget] = useState('');
  const [editPnlDir, setEditPnlDir] = useState<'above' | 'below'>('above');
  const [editPnlNote, setEditPnlNote] = useState('');
  const [rearmPnlId, setRearmPnlId] = useState<string | null>(null);
  const [rearmPnlTarget, setRearmPnlTarget] = useState('');
  const [rearmPnlDir, setRearmPnlDir] = useState<'above' | 'below'>('above');
  const [confirmPnlClear, setConfirmPnlClear] = useState(false);
  const [pnlSort, setPnlSort] = useState<'date' | 'dist' | 'amount'>('amount');
  const [persistent, setPersistent] = useState(false);
  const [pnlPersistent, setPnlPersistent] = useState(false);
  const [editPersistent, setEditPersistent] = useState(false);
  const [editPnlPersistent, setEditPnlPersistent] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<PriceAlert[]>([]);
  const [recentPnlAlerts, setRecentPnlAlerts] = useState<PnlAlert[]>([]);
  const [, setTick] = useState(0);

  // Auto-dismiss triggered alerts after 60s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expired = priceAlerts.filter(a => a.triggered && !a.persistent && a.triggeredAt && now - a.triggeredAt > 60000);
      const expiredPnl = pnlAlerts.filter(a => a.triggered && !a.persistent && a.triggeredAt && now - a.triggeredAt > 60000);
      if (expired.length > 0) {
        setRecentAlerts(prev => [...expired, ...prev].slice(0, 5));
        expired.forEach(a => dismissAlert(a.id));
      }
      if (expiredPnl.length > 0) {
        setRecentPnlAlerts(prev => [...expiredPnl, ...prev].slice(0, 5));
        expiredPnl.forEach(a => dismissPnlAlert(a.id));
      }
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [priceAlerts, pnlAlerts, dismissAlert, dismissPnlAlert]);

  const handleAddPnl = () => {
    const val = parseFloat(pnlTarget);
    if (isNaN(val)) return;
    addPnlAlert({ targetPnl: val, direction: pnlDir, note: pnlNote, persistent: pnlPersistent });
    setPnlTarget('');
    setPnlNote('');
    setPnlPersistent(false);
    setShowPnlForm(false);
  };

  const sortPnlAlerts = <T extends { id: string; targetPnl: number; createdAt?: number }>(list: T[]): T[] => {
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (pnlSort === 'date') cmp = (b.createdAt ?? 0) - (a.createdAt ?? 0);
      else if (pnlSort === 'dist') cmp = Math.abs(a.targetPnl - unrealizedPnl) - Math.abs(b.targetPnl - unrealizedPnl);
      else cmp = a.targetPnl - b.targetPnl;
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });
    return sorted;
  };

  const activePnl = sortPnlAlerts(pnlAlerts.filter(a => !a.triggered));
  const triggeredPnl = sortPnlAlerts(pnlAlerts.filter(a => a.triggered));

  const handleAdd = () => {
    const price = parseFloat(targetPrice);
    if (!asset || !price || price <= 0) return;
    addPriceAlert({ asset, targetPrice: price, direction, note, persistent });
    setTargetPrice('');
    setNote('');
    setPersistent(false);
    setShowForm(false);
  };

  const fmtDate = (ts?: number) => ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) : '';
  const [alertSort, setAlertSort] = useState<'symbol' | 'date' | 'dist'>('dist');

  const getDist = (a: { asset: string; targetPrice: number }) => {
    const cur = prices[a.asset];
    return cur ? ((a.targetPrice - cur) / cur * 100) : 0;
  };

  const sortAlerts = <T extends { id: string; asset: string; targetPrice: number; createdAt?: number }>(list: T[]): T[] => {
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (alertSort === 'symbol') cmp = a.asset.localeCompare(b.asset);
      else if (alertSort === 'date') cmp = (b.createdAt ?? 0) - (a.createdAt ?? 0);
      else cmp = Math.abs(getDist(a)) - Math.abs(getDist(b));
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });
    return sorted;
  };

  const active = sortAlerts(priceAlerts.filter(a => !a.triggered));
  const triggered = sortAlerts(priceAlerts.filter(a => a.triggered));

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold">Price Alerts</h2>
        <button onClick={() => {
            if (!showForm) {
              const cur = prices[asset];
              if (cur) setTargetPrice(String(cur));
              setDirection('below');
              setNote('');
            }
            setShowForm(!showForm);
          }}
          className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600">
          {showForm ? 'Cancel' : '+ Alert'}
        </button>
      </div>
      <div className="flex gap-1 mb-3">
        {(['symbol', 'date', 'dist'] as const).map(s => (
          <button key={s} onClick={() => setAlertSort(s)}
            className={`px-2 py-0.5 rounded text-[10px] ${alertSort === s ? 'bg-slate-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'}`}>
            {s === 'symbol' ? 'Symbol' : s === 'date' ? 'Date' : 'Distance'}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-slate-900 rounded-lg p-3 mb-3 space-y-2">
          <div className="flex gap-2 items-end flex-wrap">
            <div className="min-w-[140px]">
              <div className="text-xs text-slate-400 mb-1">Asset</div>
              <AssetPicker value={asset} onChange={(v) => { setAsset(v); const cur = prices[v]; if (cur) setTargetPrice(String(cur)); }} prices={prices} />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Direction</div>
              <div className="flex">
                <button onClick={() => setDirection('above')}
                  className={`px-3 py-1.5 text-xs rounded-l ${direction === 'above' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  Above
                </button>
                <button onClick={() => setDirection('below')}
                  className={`px-3 py-1.5 text-xs rounded-r ${direction === 'below' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  Below
                </button>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Price {prices[asset] ? `(now ${prices[asset].toLocaleString()})` : ''}</div>
              <input type="number" value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
                step={priceStep(targetPrice)} placeholder="Target price"
                className="bg-slate-700 rounded px-2 py-1.5 text-xs font-mono w-28" />
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Note</div>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder="Optional"
                className="bg-slate-700 rounded px-2 py-1.5 text-xs w-24" />
            </div>
            <button onClick={() => setPersistent(p => !p)}
              className={`px-2 py-1.5 rounded text-xs font-bold ${persistent ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-300'}`}
              title="Persistent: stays active after firing">
              {persistent ? '∞ On' : '∞'}
            </button>
            <button onClick={handleAdd}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-500">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] text-purple-400 uppercase tracking-wide">Triggered</div>
            <button onClick={() => {
                if (confirmClear) { triggered.forEach(a => dismissAlert(a.id)); setConfirmClear(false); }
                else setConfirmClear(true);
              }}
              onBlur={() => setConfirmClear(false)}
              className={`text-[10px] ${confirmClear ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}>
              {confirmClear ? 'Confirm' : 'Clear all'}
            </button>
          </div>
          {triggered.map(a => {
            const isRearming = rearmId === a.id;
            return isRearming ? (
              <div key={a.id} className="flex items-center gap-2 bg-purple-900/30 border border-purple-800/60 rounded px-3 py-2 text-xs">
                <span className="font-bold text-purple-300 w-12">{a.asset}</span>
                <button onClick={() => setRearmDir(d => d === 'above' ? 'below' : 'above')}
                  className={`px-1.5 py-0.5 rounded ${rearmDir === 'above' ? 'bg-green-700 text-green-300' : 'bg-red-700 text-red-300'}`}>
                  {rearmDir === 'above' ? '↑' : '↓'}
                </button>
                <input type="number" value={rearmPrice} onChange={e => setRearmPrice(e.target.value)}
                  step={priceStep(rearmPrice)} autoFocus
                  className="w-24 bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono"
                  onKeyDown={e => {
                    if (e.key === 'Enter') { const p = parseFloat(rearmPrice); if (p > 0) { rearmAlert(a.id, { targetPrice: p, direction: rearmDir }); setRearmId(null); } }
                    if (e.key === 'Escape') setRearmId(null);
                  }} />
                <button onClick={() => { const p = parseFloat(rearmPrice); if (p > 0) { rearmAlert(a.id, { targetPrice: p, direction: rearmDir }); setRearmId(null); } }}
                  className="px-2 py-0.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-500">Re-arm</button>
                <button onClick={() => setRearmId(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs">X</button>
              </div>
            ) : (
              <div key={a.id} className="flex items-center justify-between bg-purple-900/30 border border-purple-800/60 rounded px-3 py-2 cursor-pointer"
                onClick={() => { setRearmId(a.id); setRearmPrice(String(a.targetPrice)); setRearmDir(a.direction); }}>
                <div className="flex items-center gap-3 text-xs min-w-0">
                  <span className="font-bold text-purple-300 w-12 shrink-0">{a.asset}</span>
                  <span className="text-purple-400 font-mono shrink-0">{a.direction === 'above' ? '↑' : '↓'} ${a.targetPrice.toLocaleString()}</span>
                  <span className="text-purple-500 font-semibold shrink-0">TRIGGERED</span>
                  {a.note && <span className="text-slate-500 truncate">{a.note}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="text-[10px] text-slate-400 text-right leading-tight">
                    {a.triggeredAt && <div>fired {fmtDate(a.triggeredAt)}</div>}
                    {a.createdAt && <div>set {fmtDate(a.createdAt)}</div>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); dismissAlert(a.id); }}
                    className="text-slate-500 hover:text-red-400 text-sm">&times;</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent (auto-dismissed) alerts */}
      {recentAlerts.length > 0 && (
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Recent</div>
            <button onClick={() => setRecentAlerts([])}
              className="text-[10px] text-slate-600 hover:text-slate-400">Clear</button>
          </div>
          {recentAlerts.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-slate-900/50 rounded px-3 py-1.5 cursor-pointer opacity-60 hover:opacity-100"
              onClick={() => {
                addPriceAlert({ asset: a.asset, targetPrice: a.targetPrice, direction: a.direction, note: a.note, persistent: a.persistent });
                setRecentAlerts(prev => prev.filter(r => r.id !== a.id));
              }}>
              <div className="flex items-center gap-3 text-xs min-w-0">
                <span className="font-bold text-slate-400 w-12 shrink-0">{a.asset}</span>
                <span className="text-slate-500 font-mono shrink-0">{a.direction === 'above' ? '↑' : '↓'} ${a.targetPrice.toLocaleString()}</span>
                {a.note && <span className="text-slate-600 truncate">{a.note}</span>}
              </div>
              <span className="text-[10px] text-slate-600 shrink-0 ml-2">click to re-add</span>
            </div>
          ))}
        </div>
      )}

      {/* Active alerts */}
      {active.length > 0 ? (
        <div className="space-y-1">
          {active.map(a => {
            const cur = prices[a.asset];
            const dist = cur ? ((a.targetPrice - cur) / cur * 100) : null;
            const isEditing = editingId === a.id;
            return isEditing ? (
              <div key={a.id} className="flex items-center gap-2 bg-slate-900 rounded px-3 py-2 text-xs">
                <span className="font-bold text-slate-200 w-12">{a.asset}</span>
                <button onClick={() => setEditDir(d => d === 'above' ? 'below' : 'above')}
                  className={`px-1.5 py-0.5 rounded ${editDir === 'above' ? 'bg-green-700 text-green-300' : 'bg-red-700 text-red-300'}`}>
                  {editDir === 'above' ? '↑' : '↓'}
                </button>
                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  step={priceStep(editPrice)} autoFocus
                  className="w-24 bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono"
                  onKeyDown={e => {
                    if (e.key === 'Enter') { const p = parseFloat(editPrice); if (p > 0) { editPriceAlert(a.id, { targetPrice: p, direction: editDir, note: editNote }); setEditingId(null); } }
                    if (e.key === 'Escape') setEditingId(null);
                  }} />
                <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)}
                  placeholder="Note"
                  className="w-20 bg-slate-700 rounded px-1.5 py-0.5 text-xs" />
                <button onClick={() => { const next = !editPersistent; setEditPersistent(next); editPriceAlert(a.id, { persistent: next }); }}
                  className={`px-1.5 py-0.5 rounded text-xs font-bold ${editPersistent ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                  title="Persistent">∞</button>
                <button onClick={() => { const p = parseFloat(editPrice); if (p > 0) { editPriceAlert(a.id, { targetPrice: p, direction: editDir, note: editNote, persistent: editPersistent }); setEditingId(null); } }}
                  className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs">OK</button>
                <button onClick={() => setEditingId(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs">X</button>
              </div>
            ) : (
              <div key={a.id} className="flex items-center justify-between bg-slate-900 rounded px-3 py-2 cursor-pointer"
                onClick={() => { setEditingId(a.id); setEditPrice(String(a.targetPrice)); setEditDir(a.direction); setEditNote(a.note); setEditPersistent(!!a.persistent); }}>
                <div className="flex items-center gap-3 text-sm min-w-0">
                  <span className="font-bold text-slate-200 w-12 shrink-0">{a.asset}</span>
                  {a.persistent && <span className="text-amber-400 font-bold text-xs shrink-0" title="Persistent">∞</span>}
                  <span className={`font-mono shrink-0 ${a.direction === 'above' ? 'text-green-400' : 'text-red-400'}`}>
                    {a.direction === 'above' ? '↑' : '↓'} ${a.targetPrice.toLocaleString()}
                  </span>
                  {dist != null && (
                    <span className={`font-mono shrink-0 ${Math.abs(dist) < 1 ? 'text-yellow-400' : Math.abs(dist) < 3 ? 'text-slate-200' : 'text-slate-400'}`}>
                      {dist >= 0 ? '+' : ''}{dist.toFixed(2)}%
                    </span>
                  )}
                  {cur != null && <span className="text-slate-400 font-mono shrink-0">${cur.toLocaleString()}</span>}
                  {a.note && <span className="text-slate-500 truncate">{a.note}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {a.createdAt && <span className="text-slate-400 text-[10px]">{fmtDate(a.createdAt)}</span>}
                  <button onClick={e => { e.stopPropagation(); deletePriceAlert(a.id); }}
                    className="text-slate-500 hover:text-red-400 text-sm">&times;</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : triggered.length === 0 && (
        <div className="text-center text-slate-500 text-xs py-2">No active alerts</div>
      )}

      {/* P&L Alerts */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">P&L Alerts</h3>
            <span className={`text-xs font-mono ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              (Current: {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)})
            </span>
          </div>
          <button onClick={() => { setShowPnlForm(!showPnlForm); setPnlTarget(''); setPnlNote(''); }}
            className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600">
            {showPnlForm ? 'Cancel' : '+ P&L'}
          </button>
        </div>
        <div className="flex gap-1 mb-3">
          {(['date', 'dist', 'amount'] as const).map(s => (
            <button key={s} onClick={() => setPnlSort(s)}
              className={`px-2 py-0.5 rounded text-[10px] ${pnlSort === s ? 'bg-slate-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'}`}>
              {s === 'date' ? 'Date' : s === 'dist' ? 'Distance' : 'Amount'}
            </button>
          ))}
        </div>

        {showPnlForm && (
          <div className="bg-slate-900 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <div className="text-xs text-slate-400 mb-1">Direction</div>
                <div className="flex">
                  <button onClick={() => setPnlDir('above')}
                    className={`px-3 py-1.5 text-xs rounded-l ${pnlDir === 'above' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    Above
                  </button>
                  <button onClick={() => setPnlDir('below')}
                    className={`px-3 py-1.5 text-xs rounded-r ${pnlDir === 'below' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    Below
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Target $</div>
                <input type="number" value={pnlTarget} onChange={e => setPnlTarget(e.target.value)}
                  placeholder="e.g. 500 or -200"
                  className="bg-slate-700 rounded px-2 py-1.5 text-xs font-mono w-28" />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Note</div>
                <input type="text" value={pnlNote} onChange={e => setPnlNote(e.target.value)}
                  placeholder="Optional"
                  className="bg-slate-700 rounded px-2 py-1.5 text-xs w-24" />
              </div>
              <button onClick={() => setPnlPersistent(p => !p)}
                className={`px-2 py-1.5 rounded text-xs font-bold ${pnlPersistent ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-300'}`}
                title="Persistent: stays active after firing">
                {pnlPersistent ? '∞ On' : '∞'}
              </button>
              <button onClick={handleAddPnl}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-500">
                Add
              </button>
            </div>
          </div>
        )}

        {/* Triggered P&L alerts */}
        {triggeredPnl.length > 0 && (
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-purple-400 uppercase tracking-wide">Triggered</div>
              <button onClick={() => {
                  if (confirmPnlClear) { triggeredPnl.forEach(a => dismissPnlAlert(a.id)); setConfirmPnlClear(false); }
                  else setConfirmPnlClear(true);
                }}
                onBlur={() => setConfirmPnlClear(false)}
                className={`text-[10px] ${confirmPnlClear ? 'text-red-400' : 'text-slate-500 hover:text-red-400'}`}>
                {confirmPnlClear ? 'Confirm' : 'Clear all'}
              </button>
            </div>
            {triggeredPnl.map(a => {
              const isRearming = rearmPnlId === a.id;
              return isRearming ? (
                <div key={a.id} className="flex items-center gap-2 bg-purple-900/30 border border-purple-800/60 rounded px-3 py-2 text-xs">
                  <span className="font-bold text-purple-300">P&L</span>
                  <button onClick={() => setRearmPnlDir(d => d === 'above' ? 'below' : 'above')}
                    className={`px-1.5 py-0.5 rounded ${rearmPnlDir === 'above' ? 'bg-green-700 text-green-300' : 'bg-red-700 text-red-300'}`}>
                    {rearmPnlDir === 'above' ? '↑' : '↓'}
                  </button>
                  <input type="number" value={rearmPnlTarget} onChange={e => setRearmPnlTarget(e.target.value)}
                    autoFocus className="w-24 bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono"
                    onKeyDown={e => {
                      if (e.key === 'Enter') { const v = parseFloat(rearmPnlTarget); if (!isNaN(v)) { rearmPnlAlert(a.id, { targetPnl: v, direction: rearmPnlDir }); setRearmPnlId(null); } }
                      if (e.key === 'Escape') setRearmPnlId(null);
                    }} />
                  <button onClick={() => { const v = parseFloat(rearmPnlTarget); if (!isNaN(v)) { rearmPnlAlert(a.id, { targetPnl: v, direction: rearmPnlDir }); setRearmPnlId(null); } }}
                    className="px-2 py-0.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-500">Re-arm</button>
                  <button onClick={() => setRearmPnlId(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs">X</button>
                </div>
              ) : (
                <div key={a.id} className="flex items-center justify-between bg-purple-900/30 border border-purple-800/60 rounded px-3 py-2 cursor-pointer"
                  onClick={() => { setRearmPnlId(a.id); setRearmPnlTarget(String(a.targetPnl)); setRearmPnlDir(a.direction); }}>
                  <div className="flex items-center gap-3 text-xs min-w-0">
                    <span className="font-bold text-purple-300 shrink-0">P&L</span>
                    <span className="text-purple-400 font-mono shrink-0">{a.direction === 'above' ? '↑' : '↓'} ${a.targetPnl}</span>
                    <span className="text-purple-500 font-semibold shrink-0">TRIGGERED</span>
                    {a.note && <span className="text-slate-500 truncate">{a.note}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-[10px] text-slate-400 text-right leading-tight">
                      {a.triggeredAt && <div>fired {fmtDate(a.triggeredAt)}</div>}
                      {a.createdAt && <div>set {fmtDate(a.createdAt)}</div>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); dismissPnlAlert(a.id); }}
                      className="text-slate-500 hover:text-red-400 text-sm">&times;</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent (auto-dismissed) P&L alerts */}
        {recentPnlAlerts.length > 0 && (
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">Recent</div>
              <button onClick={() => setRecentPnlAlerts([])}
                className="text-[10px] text-slate-600 hover:text-slate-400">Clear</button>
            </div>
            {recentPnlAlerts.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-slate-900/50 rounded px-3 py-1.5 cursor-pointer opacity-60 hover:opacity-100"
                onClick={() => {
                  addPnlAlert({ targetPnl: a.targetPnl, direction: a.direction, note: a.note, persistent: a.persistent });
                  setRecentPnlAlerts(prev => prev.filter(r => r.id !== a.id));
                }}>
                <div className="flex items-center gap-3 text-xs min-w-0">
                  <span className="font-bold text-slate-400 shrink-0">P&L</span>
                  <span className="text-slate-500 font-mono shrink-0">{a.direction === 'above' ? '↑' : '↓'} ${a.targetPnl}</span>
                  {a.note && <span className="text-slate-600 truncate">{a.note}</span>}
                </div>
                <span className="text-[10px] text-slate-600 shrink-0 ml-2">click to re-add</span>
              </div>
            ))}
          </div>
        )}

        {/* Active P&L alerts */}
        {activePnl.length > 0 ? (
          <div className="space-y-1">
            {activePnl.map(a => {
              const isEditing = editingPnlId === a.id;
              return isEditing ? (
                <div key={a.id} className="flex items-center gap-2 bg-slate-900 rounded px-3 py-2 text-xs">
                  <span className="font-bold text-slate-200">P&L</span>
                  <button onClick={() => setEditPnlDir(d => d === 'above' ? 'below' : 'above')}
                    className={`px-1.5 py-0.5 rounded ${editPnlDir === 'above' ? 'bg-green-700 text-green-300' : 'bg-red-700 text-red-300'}`}>
                    {editPnlDir === 'above' ? '↑' : '↓'}
                  </button>
                  <input type="number" value={editPnlTarget} onChange={e => setEditPnlTarget(e.target.value)}
                    autoFocus className="w-24 bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono"
                    onKeyDown={e => {
                      if (e.key === 'Enter') { const v = parseFloat(editPnlTarget); if (!isNaN(v)) { editPnlAlert(a.id, { targetPnl: v, direction: editPnlDir, note: editPnlNote }); setEditingPnlId(null); } }
                      if (e.key === 'Escape') setEditingPnlId(null);
                    }} />
                  <input type="text" value={editPnlNote} onChange={e => setEditPnlNote(e.target.value)}
                    placeholder="Note" className="w-20 bg-slate-700 rounded px-1.5 py-0.5 text-xs" />
                  <button onClick={() => { const next = !editPnlPersistent; setEditPnlPersistent(next); editPnlAlert(a.id, { persistent: next }); }}
                    className={`px-1.5 py-0.5 rounded text-xs font-bold ${editPnlPersistent ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                    title="Persistent">∞</button>
                  <button onClick={() => { const v = parseFloat(editPnlTarget); if (!isNaN(v)) { editPnlAlert(a.id, { targetPnl: v, direction: editPnlDir, note: editPnlNote, persistent: editPnlPersistent }); setEditingPnlId(null); } }}
                    className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs">OK</button>
                  <button onClick={() => setEditingPnlId(null)}
                    className="text-slate-400 hover:text-slate-200 text-xs">X</button>
                </div>
              ) : (
                <div key={a.id} className="flex items-center justify-between bg-slate-900 rounded px-3 py-2 cursor-pointer"
                  onClick={() => { setEditingPnlId(a.id); setEditPnlTarget(String(a.targetPnl)); setEditPnlDir(a.direction); setEditPnlNote(a.note); setEditPnlPersistent(!!a.persistent); }}>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold text-slate-200">P&L</span>
                    {a.persistent && <span className="text-amber-400 font-bold text-xs" title="Persistent">∞</span>}
                    <span className={`font-mono ${a.direction === 'above' ? 'text-green-400' : 'text-red-400'}`}>
                      {a.direction === 'above' ? '↑' : '↓'} ${a.targetPnl}
                    </span>
                    {(() => { const dist = a.targetPnl - unrealizedPnl; const abs = Math.abs(dist); return (
                      <span className={`font-mono shrink-0 ${abs < 50 ? 'text-yellow-400' : abs < 200 ? 'text-slate-200' : 'text-slate-400'}`}>
                        {dist >= 0 ? '+' : '-'}${Math.abs(dist).toFixed(0)}
                      </span>
                    ); })()}
                    {a.note && <span className="text-slate-500 truncate">{a.note}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {a.createdAt && <span className="text-slate-400 text-[10px]">{fmtDate(a.createdAt)}</span>}
                    <button onClick={e => { e.stopPropagation(); deletePnlAlert(a.id); }}
                      className="text-slate-500 hover:text-red-400 text-sm">&times;</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : triggeredPnl.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-2">No P&L alerts</div>
        )}
      </div>
    </div>
  );
}
