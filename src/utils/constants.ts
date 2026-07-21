export const DEFAULT_SETTINGS = {
  startingBalance: 100000,
  dailyHardDrawdownPct: 3,
  totalDrawdownPct: 6,
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
}

export const ACCOUNTS: AccountInfo[] = [
  { id: 'main', label: 'Account 1' },
  { id: 'second', label: 'Account 2' },
];

export const DEFAULT_ACCOUNT_ID = 'main';

export const SUPPORTED_ASSETS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'DOGE', 'ATOM', 'UNI', 'LTC', 'NEAR', 'APT',
  'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'INJ', 'FET', 'RNDR',
  'ASTR', 'HYPE', 'TRUMP', 'TAO', 'PUMP', 'FARTCOIN', 'BCH',
  'BONK', 'AAVE', 'LDO', 'KAS', 'BNB',
  'PEPE', 'WIF', 'FLOKI', 'SHIB', 'FIL', 'IMX', 'GRT',
  'PENDLE', 'JUP', 'ENA', 'ONDO', 'STX', 'MKR', 'RENDER',
  'TRX', 'TON', 'XLM', 'ALGO', 'VET', 'SAND', 'MANA', 'AXS',
  'CRV', 'SNX', 'COMP', 'SUSHI', 'DYDX', 'BLUR', 'W', 'PYTH',
  'JTO', 'STRK', 'MEME', 'ORDI', 'RUNE', 'WLD', 'FTM',
] as const;

export const CORRELATION_GROUPS: string[][] = [
  ['BTC', 'ETH'],
  ['SOL', 'AVAX', 'NEAR', 'APT', 'SUI', 'SEI'],
  ['LINK', 'DOT', 'ATOM'],
  ['ARB', 'OP', 'MATIC'],
  ['DOGE'],
];

export type Asset = typeof SUPPORTED_ASSETS[number];
