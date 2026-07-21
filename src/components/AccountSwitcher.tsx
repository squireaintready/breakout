import { ACCOUNTS } from '../utils/constants';
import { getAccountId, setAccountId } from '../utils/account';
import { useStore } from '../store/useStore';

// Switching accounts swaps the entire dataset. We flush any pending local edits
// to the cloud first, then reload so the store re-hydrates from the newly
// selected account's localStorage + cloud keys (both derived at module load).
export default function AccountSwitcher() {
  const current = getAccountId();

  const onChange = async (id: string) => {
    if (id === current) return;
    try {
      await useStore.getState().pushCloud();
    } catch {
      // Best-effort flush; local data is still safe in this account's storage.
    }
    setAccountId(id);
    window.location.reload();
  };

  return (
    <select
      value={current}
      onChange={e => onChange(e.target.value)}
      aria-label="Account"
      className="bg-slate-800 border border-slate-700 rounded text-xs px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
    >
      {ACCOUNTS.map(a => (
        <option key={a.id} value={a.id}>{a.label}</option>
      ))}
    </select>
  );
}
