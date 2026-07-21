import { ACCOUNTS, DEFAULT_ACCOUNT_ID, type AccountInfo } from './constants';

// Which dataset the app is currently viewing. Persisted separately from the
// per-account store so it survives reloads and is readable before the Zustand
// store hydrates (the persist `name` is derived from it at module load).
const ACCOUNT_KEY = 'breakout-account';

export function getAccountId(): string {
  try {
    const id = localStorage.getItem(ACCOUNT_KEY);
    return ACCOUNTS.some(a => a.id === id) ? (id as string) : DEFAULT_ACCOUNT_ID;
  } catch {
    return DEFAULT_ACCOUNT_ID;
  }
}

export function setAccountId(id: string): void {
  localStorage.setItem(ACCOUNT_KEY, id);
}

export function getAccount(): AccountInfo {
  const id = getAccountId();
  return ACCOUNTS.find(a => a.id === id) ?? ACCOUNTS[0];
}

// Backward-compatible key mapping: the default account keeps the legacy,
// un-suffixed keys ('breakout-store' locally, 'breakout-state' in Redis) so
// pre-existing data is preserved. Additional accounts are namespaced by id.
export function storeName(id: string = getAccountId()): string {
  return id === DEFAULT_ACCOUNT_ID ? 'breakout-store' : `breakout-store:${id}`;
}
