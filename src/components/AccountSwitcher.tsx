import { useState } from 'react';
import { ACCOUNTS } from '../utils/constants';
import { useStore } from '../store/useStore';

// Switching swaps the whole dataset in place — see `switchAccount` in the store.
// It reads from localStorage first, so the new account paints immediately and
// the cloud refresh lands behind it.
export default function AccountSwitcher() {
  const accountId = useStore(s => s.accountId);
  const switchAccount = useStore(s => s.switchAccount);
  const [busy, setBusy] = useState(false);

  const onChange = async (id: string) => {
    if (id === accountId || busy) return;
    setBusy(true);
    try {
      await switchAccount(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      value={accountId}
      disabled={busy}
      onChange={e => onChange(e.target.value)}
      aria-label="Account"
      aria-busy={busy}
      className="bg-slate-800 border border-slate-700 rounded text-xs px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-60"
    >
      {ACCOUNTS.map(a => (
        <option key={a.id} value={a.id}>{a.label}</option>
      ))}
    </select>
  );
}
