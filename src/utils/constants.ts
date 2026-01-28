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

export const SUPPORTED_ASSETS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'DOGE', 'ATOM', 'UNI', 'LTC', 'NEAR', 'APT',
  'ARB', 'OP', 'SUI', 'SEI', 'TIA', 'INJ', 'FET', 'RNDR',
  'ASTR', 'HYPE', 'TRUMP', 'TAO', 'PUMP', 'FARTCOIN', 'BCH',
  'BONK', 'AAVE', 'LDO',
] as const;

export const CORRELATION_GROUPS: string[][] = [
  ['BTC', 'ETH'],
  ['SOL', 'AVAX', 'NEAR', 'APT', 'SUI', 'SEI'],
  ['LINK', 'DOT', 'ATOM'],
  ['ARB', 'OP', 'MATIC'],
  ['DOGE'],
];

export type Asset = typeof SUPPORTED_ASSETS[number];
