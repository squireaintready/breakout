import type { AppState } from './types.js';

const API_URL = process.env.BREAKOUT_API_URL || '';
const PASSWORD = process.env.BREAKOUT_PASSWORD || '';

let cachedState: AppState | null = null;
let pollInterval: ReturnType<typeof setInterval> | undefined;

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (PASSWORD) h['Authorization'] = `Bearer ${PASSWORD}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function fetchState(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/state`, { headers: headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as AppState | null;
    if (data && typeof data === 'object' && data.balance !== undefined) {
      cachedState = data;
    }
  } catch (err) {
    console.error('[state] Fetch error:', err);
  }
}

export async function pushState(state: AppState): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/state`, {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify(state),
    });
    if (!res.ok) console.error('[state] Push failed:', res.status);
  } catch (err) {
    console.error('[state] Push error:', err);
  }
}

export function getState(): AppState | null {
  return cachedState;
}

export function startPolling(intervalMs: number): void {
  fetchState();
  pollInterval = setInterval(fetchState, intervalMs);
}

export function stopPolling(): void {
  clearInterval(pollInterval);
}
