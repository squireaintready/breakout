import 'dotenv/config';
import { connect, disconnect, prices, onPrice } from './kraken.js';
import { startPolling, stopPolling, getState } from './state.js';
import { checkAlerts, cleanFiredSet } from './alerts.js';
import { sendTelegram } from './telegram.js';

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

  const state = getState();
  if (!state) return;

  cleanFiredSet(state);
  checkAlerts(prices, state);
}

// Start
console.log('[main] Starting alert checker...');
startPolling(10_000);
connect();
onPrice(throttledCheck);

sendTelegram('<b>🟢 Alert checker online</b>');

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
