import type { ReactNode } from 'react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◉' },
  { id: 'drawdown', label: 'Drawdown', icon: '▼' },
  { id: 'journal', label: 'Journal', icon: '☰' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
] as const;

export type TabId = typeof TABS[number]['id'];

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: ReactNode;
  syncing?: boolean;
}

export default function Layout({ activeTab, onTabChange, children, syncing }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight">Breakout</h1>
          {syncing && <span className="text-xs text-blue-400 animate-pulse">syncing...</span>}
        </div>
        <div className="hidden sm:flex gap-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1 rounded text-sm ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 max-w-4xl mx-auto w-full">
        {children}
      </main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 text-center text-xs ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500'}`}>
            <div className="text-lg">{tab.icon}</div>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
