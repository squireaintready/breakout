import { useStore } from '../store/useStore';
import { calcDailyDrawdownPct, calcTotalDrawdownPct } from '../utils/drawdown';

export default function AlertBanner() {
  const { balance, dayStartBalance, highWaterMark, settings } = useStore();
  const dailyDD = calcDailyDrawdownPct(balance, dayStartBalance);
  const totalDD = calcTotalDrawdownPct(balance, highWaterMark);

  const alerts: { message: string; level: 'yellow' | 'red' }[] = [];

  // Soft daily (1%)
  if (dailyDD >= settings.dailySoftDrawdownPct * 0.9) {
    alerts.push({ message: `Daily soft limit critical: ${dailyDD.toFixed(2)}% / ${settings.dailySoftDrawdownPct}%`, level: 'red' });
  } else if (dailyDD >= settings.dailySoftDrawdownPct * 0.7) {
    alerts.push({ message: `Approaching daily soft limit: ${dailyDD.toFixed(2)}% / ${settings.dailySoftDrawdownPct}%`, level: 'yellow' });
  }

  // Hard daily (3%)
  if (dailyDD >= settings.dailyHardDrawdownPct * 0.83) {
    alerts.push({ message: `DAILY HARD LIMIT DANGER: ${dailyDD.toFixed(2)}% / ${settings.dailyHardDrawdownPct}%`, level: 'red' });
  } else if (dailyDD >= settings.dailyHardDrawdownPct * 0.67) {
    alerts.push({ message: `Warning: daily hard limit: ${dailyDD.toFixed(2)}% / ${settings.dailyHardDrawdownPct}%`, level: 'yellow' });
  }

  // Total (6%)
  if (totalDD >= settings.totalDrawdownPct * 0.92) {
    alerts.push({ message: `TOTAL DRAWDOWN CRITICAL: ${totalDD.toFixed(2)}% / ${settings.totalDrawdownPct}%`, level: 'red' });
  } else if (totalDD >= settings.totalDrawdownPct * 0.75) {
    alerts.push({ message: `Total drawdown warning: ${totalDD.toFixed(2)}% / ${settings.totalDrawdownPct}%`, level: 'yellow' });
  }

  const { priceAlerts, dismissAlert } = useStore();
  const triggered = priceAlerts.filter(a => a.triggered);

  if (alerts.length === 0 && triggered.length === 0) return null;

  return (
    <div className="space-y-1">
      {alerts.map((a, i) => (
        <div key={i} className={`px-4 py-2 text-sm font-semibold text-center ${
          a.level === 'red' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black'
        }`}>
          {a.message}
        </div>
      ))}
      {triggered.map(a => (
        <div key={a.id} className="px-4 py-2 text-sm font-semibold text-center bg-purple-600 text-white flex items-center justify-center gap-2">
          <span>{a.asset} {a.direction === 'above' ? '↑' : '↓'} {a.targetPrice.toLocaleString()} — TRIGGERED{a.note ? ` (${a.note})` : ''}</span>
          <button onClick={() => dismissAlert(a.id)} className="text-purple-200 hover:text-white text-lg leading-none">&times;</button>
        </div>
      ))}
    </div>
  );
}
