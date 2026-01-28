import { useState } from 'react';
import { useStore } from '../store/useStore';
import { calculatePositionSize } from '../utils/positionSizing';
import { calcRiskIfAllStopsHit, calcDailyDrawdownPct, calcTotalDrawdownPct } from '../utils/drawdown';
import { CORRELATION_GROUPS, BTC_ETH_ASSETS } from '../utils/constants';
import type { PriceMap } from '../hooks/useKrakenPrices';
import AssetPicker from './AssetPicker';

interface Props {
  prices: PriceMap;
}

export default function PositionSizer({ prices }: Props) {
  const { balance, dayStartBalance, highWaterMark, positions, settings, addPosition } = useStore();
  const [asset, setAsset] = useState<string>('BTC');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [riskPct, setRiskPct] = useState(1);
  const [manualSize, setManualSize] = useState('');

  const entry = parseFloat(entryPrice) || prices[asset] || 0;
  const stop = parseFloat(stopLoss) || 0;
  const maxLev = BTC_ETH_ASSETS.includes(asset) ? settings.btcEthLeverage : settings.altLeverage;

  const canCalc = entry > 0 && stop > 0 && entry !== stop;
  const result = canCalc ? calculatePositionSize({
    asset, entryPrice: entry, stopLoss: stop, riskPct, balance,
    btcEthLeverage: settings.btcEthLeverage, altLeverage: settings.altLeverage,
    side, tradingFeePct: settings.tradingFeePct,
  }) : null;

  // What-if simulation
  const existingRisk = calcRiskIfAllStopsHit(positions, balance, settings.tradingFeePct);
  const newTradeRisk = result ? (result.dollarRisk / balance) * 100 : 0;
  const dailyDD = calcDailyDrawdownPct(balance, dayStartBalance);
  const totalDD = calcTotalDrawdownPct(balance, highWaterMark);
  const simDailyDD = dailyDD + existingRisk + newTradeRisk;
  const simTotalDD = totalDD + existingRisk + newTradeRisk;

  // Warnings
  let warning: { level: 'yellow' | 'red'; msg: string } | null = null;
  if (simDailyDD > settings.dailyHardDrawdownPct * 0.67 || simTotalDD > settings.totalDrawdownPct * 0.75) {
    warning = { level: 'red', msg: `Would approach hard limits! Daily: ${simDailyDD.toFixed(2)}%, Total: ${simTotalDD.toFixed(2)}%` };
  } else if (simDailyDD > settings.dailySoftDrawdownPct) {
    warning = { level: 'yellow', msg: `Would exceed soft daily limit (${settings.dailySoftDrawdownPct}%): ${simDailyDD.toFixed(2)}%` };
  }

  // Correlation warning
  const correlationWarning = (() => {
    const group = CORRELATION_GROUPS.find(g => g.includes(asset));
    if (!group) return null;
    const correlated = positions.filter(p => group.includes(p.asset) && p.side === side);
    if (correlated.length > 0) {
      return `Correlation: already ${side} on ${correlated.map(p => p.asset).join(', ')}`;
    }
    return null;
  })();

  const recommendedLots = result && entry > 0 ? result.recommendedSize / entry : 0;
  const manualLots = parseFloat(manualSize) || 0;
  const finalLots = manualLots || recommendedLots;
  const finalNotional = finalLots * entry;

  const handleAddPosition = () => {
    if (finalLots <= 0 || entry <= 0) return;
    addPosition({ asset, side, entryPrice: entry, size: finalNotional, stopLoss: stop || null, takeProfit: null });
    setEntryPrice('');
    setStopLoss('');
    setManualSize('');
  };

  const remainingBudget = Math.max(0, settings.dailySoftDrawdownPct - dailyDD - existingRisk);

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h2 className="text-lg font-bold mb-3">Position Sizer</h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-slate-400">Asset</label>
          <AssetPicker value={asset} onChange={setAsset} prices={prices} />
        </div>
        <div>
          <label className="text-xs text-slate-400">Side</label>
          <div className="flex gap-1">
            <button onClick={() => setSide('long')}
              className={`flex-1 py-1.5 rounded text-sm font-semibold ${side === 'long' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              Long
            </button>
            <button onClick={() => setSide('short')}
              className={`flex-1 py-1.5 rounded text-sm font-semibold ${side === 'short' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              Short
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-slate-400">Entry Price</label>
          <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
            placeholder={prices[asset] ? `${prices[asset]}` : '0'}
            className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
        </div>
        <div>
          <label className="text-xs text-slate-400">Stop Loss</label>
          <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-400">Risk % (Budget remaining: {remainingBudget.toFixed(2)}%)</label>
        <div className="flex gap-1 mt-1">
          {[0.25, 0.5, 1].map(r => (
            <button key={r} onClick={() => setRiskPct(r)}
              className={`flex-1 py-1 rounded text-sm ${riskPct === r ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {r}%
            </button>
          ))}
          <input type="number" value={riskPct} onChange={e => setRiskPct(parseFloat(e.target.value) || 0)}
            className="w-16 bg-slate-700 rounded px-2 py-1 text-sm font-mono text-center" step="0.1" />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-400">Manual Lots Override (1 lot = 1 {asset})</label>
        <input type="number" value={manualSize} onChange={e => setManualSize(e.target.value)}
          placeholder={recommendedLots > 0 ? `${recommendedLots.toFixed(6)}` : 'Auto from risk %'}
          step="any"
          className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
        {manualLots > 0 && entry > 0 && (
          <span className="text-xs text-slate-500">= ${(manualLots * entry).toLocaleString(undefined, { maximumFractionDigits: 2 })} notional</span>
        )}
      </div>

      {correlationWarning && (
        <div className="bg-orange-900/50 text-orange-300 text-xs px-3 py-2 rounded mb-2">
          {correlationWarning}
        </div>
      )}

      {warning && (
        <div className={`text-xs px-3 py-2 rounded mb-2 ${
          warning.level === 'red' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'
        }`}>
          {warning.msg}
        </div>
      )}

      {result && (
        <div className="bg-slate-900 rounded-lg p-3 text-sm space-y-1 mb-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="text-slate-400">Stop Distance</div>
            <div className="font-mono text-right">{result.stopDistancePct.toFixed(2)}%</div>
            <div className="text-slate-400 font-semibold">Recommended Lots</div>
            <div className="font-mono text-right font-bold text-blue-400">
              {recommendedLots.toFixed(6)} {asset}
            </div>
            <div className="text-slate-400">Notional Value</div>
            <div className="font-mono text-right">
              ${result.recommendedSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-slate-400">Margin Used</div>
            <div className="font-mono text-right">
              ${(result.recommendedSize / maxLev).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-slate-500 text-xs ml-1">({maxLev}x)</span>
            </div>
            <div className="text-slate-400 text-xs">Margin/Lot</div>
            <div className="font-mono text-right text-xs">${(entry / maxLev).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className="text-slate-400 text-xs">Lots (Risk)</div>
            <div className="font-mono text-right text-xs">{(result.sizeFromRisk / entry).toFixed(6)}</div>
            <div className="text-slate-400 text-xs">Lots (Lev {maxLev}x)</div>
            <div className="font-mono text-right text-xs">{(result.sizeFromLeverage / entry).toFixed(6)}</div>
            <div className="text-slate-400">Dollar Risk</div>
            <div className="font-mono text-right">${result.dollarRisk.toFixed(2)}</div>
            <div className="text-slate-400">Leverage Used</div>
            <div className="font-mono text-right">{result.leverageUsed.toFixed(2)}x</div>
            <div className="text-slate-400">Est. Liquidation</div>
            <div className="font-mono text-right">${result.estimatedLiquidationPrice.toFixed(2)}</div>
            <div className="text-slate-400">Entry Fee</div>
            <div className="font-mono text-right">${result.entryFee.toFixed(2)}</div>
            <div className="text-slate-400">Exit Fee (est.)</div>
            <div className="font-mono text-right">${result.exitFee.toFixed(2)}</div>
            <div className="text-slate-400">Total Fees</div>
            <div className="font-mono text-right">${result.totalFees.toFixed(2)}</div>
          </div>

          <div className="border-t border-slate-700 pt-1 mt-2">
            <div className="text-xs text-slate-500">What-if all stops hit:</div>
            <div className="grid grid-cols-2 gap-x-4">
              <div className="text-slate-400 text-xs">Daily DD</div>
              <div className={`font-mono text-right text-xs ${simDailyDD > settings.dailySoftDrawdownPct ? 'text-red-400' : 'text-green-400'}`}>
                {simDailyDD.toFixed(2)}%
              </div>
              <div className="text-slate-400 text-xs">Total DD</div>
              <div className={`font-mono text-right text-xs ${simTotalDD > settings.totalDrawdownPct * 0.75 ? 'text-red-400' : 'text-green-400'}`}>
                {simTotalDD.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={handleAddPosition} disabled={finalLots <= 0 || entry <= 0}
        className="w-full py-2 rounded-lg font-semibold text-sm bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500 transition">
        Open {finalLots > 0 ? `${finalLots.toFixed(6)} ${asset}` : 'Position'} {finalNotional > 0 ? `($${Math.round(finalNotional).toLocaleString()})` : ''}
      </button>
    </div>
  );
}
