import type { AppState, AccountRef } from './types.js';

const API_URL = process.env.BREAKOUT_API_URL || '';
const PASSWORD = process.env.BREAKOUT_PASSWORD || '';
const DEFAULT_ACCOUNT = 'main';

// Accounts to watch, from BREAKOUT_ACCOUNTS (comma-separated). Each entry is
// `id` or `id:Label` — e.g. "main:Account 1,second:Account 2". Defaults to a
// single default account, so an unconfigured worker behaves exactly as before.
function parseAccounts(): AccountRef[] {
  const raw = (process.env.BREAKOUT_ACCOUNTS || DEFAULT_ACCOUNT)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: AccountRef[] = [];
  for (const entry of raw) {
    const [idPart, ...labelParts] = entry.split(':');
    const id = idPart.trim();
    if (!/^[a-z0-9_-]{1,32}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: labelParts.join(':').trim() || id });
  }
  return out.length ? out : [{ id: DEFAULT_ACCOUNT, label: DEFAULT_ACCOUNT }];
}

const accounts = parseAccounts();
const cachedStates = new Map<string, AppState>();
let pollInterval: ReturnType<typeof setInterval> | undefined;
let fetching = false;

const REQUEST_TIMEOUT_MS = 8000;

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (PASSWORD) h['Authorization'] = `Bearer ${PASSWORD}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function fetchState(): Promise<void> {
  if (fetching) return; // skip if a previous poll is still in flight
  fetching = true;
  try {
    await Promise.all(accounts.map(async ({ id }) => {
      try {
        const res = await fetch(`${API_URL}/api/state?account=${encodeURIComponent(id)}`, {
          headers: headers(),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as AppState | null;
        if (data && typeof data === 'object' && data.balance !== undefined) {
          cachedStates.set(id, data);
        }
      } catch (err) {
        console.error(`[state] Fetch error (${id}):`, err);
      }
    }));
  } finally {
    fetching = false;
  }
}

export async function pushState(accountId: string, state: AppState): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/state?account=${encodeURIComponent(accountId)}`, {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify(state),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) console.error(`[state] Push failed (${accountId}):`, res.status);
  } catch (err) {
    console.error(`[state] Push error (${accountId}):`, err);
  }
}

export function getStates(): Map<string, AppState> {
  return cachedStates;
}

export function getAccounts(): AccountRef[] {
  return accounts;
}

export function startPolling(intervalMs: number): void {
  fetchState();
  pollInterval = setInterval(fetchState, intervalMs);
}

export function stopPolling(): void {
  clearInterval(pollInterval);
}
