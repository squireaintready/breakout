import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { PriceMap } from '../hooks/useKrakenPrices';
import AssetPicker from './AssetPicker';
import { priceStep } from '../utils/priceStep';

interface Props {
  prices: PriceMap;
  onClose: () => void;
}

export default function TradeForm({ prices, onClose }: Props) {
  const { addPosition } = useStore();
  const [asset, setAsset] = useState('BTC');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [qty, setQty] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const price = parseFloat(entryPrice) || prices[asset] || 0;
  const quantity = parseFloat(qty) || 0;
  const notional = price * quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (price <= 0 || quantity <= 0) return;
    addPosition({
      asset, side, entryPrice: price, size: notional,
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={handleSubmit}
        className="bg-slate-800 rounded-t-xl sm:rounded-xl p-4 w-full sm:max-w-md space-y-3">
        <h3 className="font-bold">Add Position Manually</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400">Asset</label>
            <AssetPicker value={asset} onChange={setAsset} prices={prices} />
          </div>
          <div>
            <label className="text-xs text-slate-400">Side</label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setSide('long')}
                className={`flex-1 py-1.5 rounded text-sm ${side === 'long' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Long</button>
              <button type="button" onClick={() => setSide('short')}
                className={`flex-1 py-1.5 rounded text-sm ${side === 'short' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>Short</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400">Entry Price</label>
            <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
              placeholder={prices[asset] ? `${prices[asset]}` : '0'}
              step={priceStep(entryPrice)}
              className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Quantity</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="0"
              step="any"
              className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Stop Loss</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
              step={priceStep(stopLoss)}
              className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Take Profit</label>
            <input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
              step={priceStep(takeProfit)}
              className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
          </div>
        </div>
        {notional > 0 && (
          <div className="text-xs text-slate-400">
            Notional: <span className="font-mono text-slate-300">${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded text-sm font-semibold">Add</button>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-600 text-white rounded text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
