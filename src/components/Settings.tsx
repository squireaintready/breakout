import { useState } from 'react';
import { useStore } from '../store/useStore';

export default function Settings() {
  const { settings, updateSettings, resetAccount, balance, highWaterMark, dayStartBalance, realizedPnl, positions, trades, equityHistory } = useStore();
  const store = useStore();
  const [importText, setImportText] = useState('');

  const handleExport = () => {
    const data = {
      balance, highWaterMark, dayStartBalance, realizedPnl,
      positions, trades, equityHistory, settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breakout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importText);
      store.importData(data);
      setImportText('');
      alert('Data imported successfully');
    } catch {
      alert('Invalid JSON');
    }
  };

  const Field = ({ label, value, onChange, type = 'number', step }: {
    label: string; value: number | string; onChange: (v: number) => void; type?: string; step?: string;
  }) => (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input type={type} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        className="w-full bg-slate-700 rounded px-2 py-1.5 text-sm font-mono" />
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Settings</h2>

      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-400">Account</h3>
        <Field label="Starting Balance ($)" value={settings.startingBalance}
          onChange={v => updateSettings({ startingBalance: v })} />

        <h3 className="text-sm font-semibold text-slate-400 mt-4">Drawdown Limits</h3>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Daily Soft (%)" value={settings.dailySoftDrawdownPct}
            onChange={v => updateSettings({ dailySoftDrawdownPct: v })} step="0.1" />
          <Field label="Daily Hard (%)" value={settings.dailyHardDrawdownPct}
            onChange={v => updateSettings({ dailyHardDrawdownPct: v })} step="0.1" />
          <Field label="Total (%)" value={settings.totalDrawdownPct}
            onChange={v => updateSettings({ totalDrawdownPct: v })} step="0.1" />
        </div>

        <h3 className="text-sm font-semibold text-slate-400 mt-4">Leverage Limits</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="BTC/ETH Max" value={settings.btcEthLeverage}
            onChange={v => updateSettings({ btcEthLeverage: v })} />
          <Field label="Alt Max" value={settings.altLeverage}
            onChange={v => updateSettings({ altLeverage: v })} />
        </div>

        <h3 className="text-sm font-semibold text-slate-400 mt-4">Fees</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Trading Fee (%)" value={settings.tradingFeePct}
            onChange={v => updateSettings({ tradingFeePct: v })} step="0.01" />
          <Field label="Daily Swap Fee (%)" value={settings.dailySwapFeePct}
            onChange={v => updateSettings({ dailySwapFeePct: v })} step="0.001" />
        </div>

        <h3 className="text-sm font-semibold text-slate-400 mt-4">Other</h3>
        <Field label="Daily Reset Hour (UTC)" value={settings.dailyResetHourUTC}
          onChange={v => updateSettings({ dailyResetHourUTC: v })} />

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm">Dark Mode</span>
          <button onClick={() => updateSettings({ darkMode: !settings.darkMode })}
            className={`w-12 h-6 rounded-full transition ${settings.darkMode ? 'bg-blue-600' : 'bg-slate-600'} relative`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition ${settings.darkMode ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-400">Data</h3>
        <button onClick={handleExport}
          className="w-full py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500">
          Export JSON Backup
        </button>
        <textarea value={importText} onChange={e => setImportText(e.target.value)}
          placeholder="Paste JSON backup here..."
          className="w-full bg-slate-700 rounded p-2 text-xs font-mono h-20 resize-none" />
        <button onClick={handleImport} disabled={!importText}
          className="w-full py-2 bg-slate-600 text-white rounded text-sm hover:bg-slate-500 disabled:opacity-40">
          Import Backup
        </button>
        <button onClick={() => { if (confirm('Reset all account data?')) resetAccount(); }}
          className="w-full py-2 bg-red-600/80 text-white rounded text-sm hover:bg-red-500">
          Reset Account
        </button>
      </div>
    </div>
  );
}
