import 'dotenv/config';
import { connect, disconnect, prices, onPrice } from './kraken.js';
import { startPolling, stopPolling, getStates, getAccounts } from './state.js';
import { checkAlerts, cleanFiredSet } from './alerts.js';
import { sendTelegram } from './telegram.js';

// Log unexpected failures instead of dying silently; systemd restarts us.
process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err);
});

// Validate env
const required = ['BREAKOUT_API_URL', 'BREAKOUT_PASSWORD', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// Throttled alert check
let lastCheck = 0;
function throttledCheck(): void {
  const now = Date.now();
  if (now - lastCheck < 500) return;
  lastCheck = now;

  const states = getStates();
  for (const account of getAccounts()) {
    const state = states.get(account.id);
    if (!state) continue;
    cleanFiredSet(account.id, state);
    checkAlerts(prices, account, state);
  }
}

// Start
const accountLabels = getAccounts().map(a => a.label).join(', ');
console.log(`[main] Starting alert checker... (accounts: ${accountLabels})`);
startPolling(10_000);
connect();
onPrice(throttledCheck);

sendTelegram(`<b>🟢 Alert checker online</b>\nWatching: ${accountLabels}`);

// Graceful shutdown
function shutdown(): void {
  console.log('[main] Shutting down...');
  stopPolling();
  disconnect();
  sendTelegram('<b>🔴 Alert checker offline</b>').then(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
