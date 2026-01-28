import { useStore } from '../store/useStore';
import { calcDailyDrawdownPct, calcTotalDrawdownPct, calcRiskIfAllStopsHit } from '../utils/drawdown';
import DrawdownBars from './DrawdownBars';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DrawdownTracker() {
  const { balance, dayStartBalance, highWaterMark, settings, positions, equityHistory } = useStore();
  const dailyDD = calcDailyDrawdownPct(balance, dayStartBalance);
  const totalDD = calcTotalDrawdownPct(balance, highWaterMark);
  const riskAtStops = calcRiskIfAllStopsHit(positions, balance, settings.tradingFeePct);

  const ddHistory = equityHistory.slice(-30).map(e => ({
    date: e.date.slice(5),
    dd: e.drawdownPct,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Drawdown Tracker</h2>

      <div className="bg-slate-800 rounded-xl p-4">
        <DrawdownBars
          label="Daily Drawdown"
          currentPct={dailyDD}
          softLimit={settings.dailySoftDrawdownPct}
          hardLimit={settings.dailyHardDrawdownPct}
        />
        <DrawdownBars
          label="Total Drawdown"
          currentPct={totalDD}
          hardLimit={settings.totalDrawdownPct}
        />
      </div>

      <div className="bg-slate-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-slate-400">High Water Mark</div>
          <div className="font-mono font-bold">${highWaterMark.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-slate-400">Day Start Balance</div>
          <div className="font-mono font-bold">${dayStartBalance.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-slate-400">Risk if All Stops Hit</div>
          <div className={`font-mono font-bold ${riskAtStops > settings.dailySoftDrawdownPct ? 'text-red-400' : 'text-green-400'}`}>
            {riskAtStops.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-slate-400">Daily Budget Remaining</div>
          <div className="font-mono font-bold">
            {Math.max(0, settings.dailySoftDrawdownPct - dailyDD - riskAtStops).toFixed(2)}%
          </div>
        </div>
      </div>

      {ddHistory.length > 1 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Daily Drawdown History</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={ddHistory}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip />
              <Bar dataKey="dd" fill="#ef4444" name="Drawdown %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
