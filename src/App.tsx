import { useState, useEffect, useMemo } from 'react';
import { useStore } from './store/useStore';
import { useKrakenPrices } from './hooks/useKrakenPrices';
import Layout, { type TabId } from './components/Layout';
import AlertBanner from './components/AlertBanner';
import Dashboard from './components/Dashboard';
import DrawdownTracker from './components/DrawdownTracker';
import TradeJournal from './components/TradeJournal';
import Settings from './components/Settings';
import TradeForm from './components/TradeForm';
import { usePriceAlerts } from './hooks/usePriceAlerts';
import { SUPPORTED_ASSETS } from './utils/constants';

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('breakout-password', pw);
    // Test the password against the API
    try {
      const res = await fetch('/api/state', {
        headers: pw ? { Authorization: `Bearer ${pw}` } : {},
      });
      if (res.status === 401) {
        setError(true);
        localStorage.removeItem('breakout-password');
        return;
      }
    } catch {
      // Network error — let them through, cloud sync will just fail silently
    }
    onUnlock();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-6 w-full max-w-xs space-y-4">
        <h1 className="text-lg font-bold text-white text-center">Breakout</h1>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          placeholder="Password"
          autoFocus
          className="w-full bg-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-400"
        />
        {error && <p className="text-red-400 text-xs text-center">Wrong password</p>}
        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-500">
          Unlock
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => !!localStorage.getItem('breakout-password'));
  const [tab, setTab] = useState<TabId>('dashboard');
  const [showTradeForm, setShowTradeForm] = useState(false);
  const { settings, checkDailyReset, pullCloud, _syncing } = useStore();

  const assets = useMemo(() => [...SUPPORTED_ASSETS], []);
  const prices = useKrakenPrices(assets);
  usePriceAlerts(prices);

  // Pull cloud state on mount
  useEffect(() => {
    pullCloud();
  }, [pullCloud]);

  // Also pull when tab becomes visible (switching back from another app/tab)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        pullCloud();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [pullCloud]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
  }, [settings.darkMode]);

  useEffect(() => {
    checkDailyReset();
    const interval = setInterval(checkDailyReset, 60000);
    return () => clearInterval(interval);
  }, [checkDailyReset]);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <Layout activeTab={tab} onTabChange={setTab} syncing={_syncing}>
      <AlertBanner />

      {tab === 'dashboard' && (
        <>
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowTradeForm(true)}
              className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600">
              + Manual Entry
            </button>
          </div>
          <Dashboard prices={prices} onAddPosition={() => setShowTradeForm(true)} />
        </>
      )}
      {tab === 'drawdown' && <DrawdownTracker />}
      {tab === 'journal' && <TradeJournal />}
      {tab === 'settings' && <Settings />}

      {showTradeForm && <TradeForm prices={prices} onClose={() => setShowTradeForm(false)} />}
    </Layout>
  );
}
