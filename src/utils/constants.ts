export const DEFAULT_SETTINGS = {
  startingBalance: 100000,
  dailyHardDrawdownPct: 3,
  totalDrawdownPct: 3,
  dailySoftDrawdownPct: 1,
  btcEthLeverage: 5,
  altLeverage: 2,
  dailyResetHourUTC: 0,
  darkMode: true,
  tradingFeePct: 0.04,
  dailySwapFeePct: 0.033,
};

export const BTC_ETH_ASSETS = ['BTC', 'ETH'];

// Multiple independent datasets ("accounts") in one deployment. Each account is
// its own isolated state (own localStorage + own cloud key), gated by the same
// shared password. The default account keeps the legacy un-suffixed storage keys
// so existing data is preserved; see src/utils/account.ts and api/state.ts.
export interface AccountInfo {
  id: string;
  label: string;
  // Account size. Seeds this account's balance/HWM/settings.startingBalance the
  // first time its store is created; afterwards the persisted per-account
  // setting wins, so editing it in Settings sticks. The drawdown/leverage rules
  // stay in DEFAULT_SETTINGS because they are percentages — identical across
  // every account size.
  startingBalance: number;
}

export const ACCOUNTS: AccountInfo[] = [
  { id: 'main', label: 'A', startingBalance: 100000 },
  { id: 'second', label: 'B', startingBalance: 100000 },
];

export const DEFAULT_ACCOUNT_ID = 'main';

export const SUPPORTED_ASSETS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK',
  'POL', 'DOGE', 'ATOM', 'UNI', 'LTC', 'NEAR', 'APT',
  'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'INJ', 'FET',
  'ASTR', 'HYPE', 'TRUMP', 'TAO', 'PUMP', 'FARTCOIN', 'BCH',
  'BONK', 'AAVE', 'LDO', 'KAS', 'BNB',
  'PEPE', 'WIF', 'FLOKI', 'SHIB', 'FIL', 'IMX', 'GRT',
  'PENDLE', 'JUP', 'ENA', 'ONDO', 'STX', 'RENDER',
  'TRX', 'TON', 'XLM', 'ALGO', 'VET', 'SAND', 'MANA', 'AXS',
  'CRV', 'SNX', 'COMP', 'SUSHI', 'DYDX', 'BLUR', 'W', 'PYTH',
  'JTO', 'STRK', 'MEME', 'RUNE', 'WLD', 'S', 'ZEC',
] as const;

export const CORRELATION_GROUPS: string[][] = [
  ['BTC', 'ETH'],
  ['SOL', 'AVAX', 'NEAR', 'APT', 'SUI', 'SEI'],
  ['LINK', 'DOT', 'ATOM'],
  ['ARB', 'OP', 'POL'],
  ['DOGE'],
];

export type Asset = typeof SUPPORTED_ASSETS[number];
