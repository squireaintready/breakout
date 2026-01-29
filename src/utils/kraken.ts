const KRAKEN_MAP: Record<string, string> = {
  BTC: 'XBT/USD',
  ETH: 'ETH/USD',
  SOL: 'SOL/USD',
  XRP: 'XRP/USD',
  ADA: 'ADA/USD',
  AVAX: 'AVAX/USD',
  DOT: 'DOT/USD',
  LINK: 'LINK/USD',
  MATIC: 'MATIC/USD',
  DOGE: 'DOGE/USD',
  ATOM: 'ATOM/USD',
  UNI: 'UNI/USD',
  LTC: 'LTC/USD',
  NEAR: 'NEAR/USD',
  APT: 'APT/USD',
  ARB: 'ARB/USD',
  OP: 'OP/USD',
  SUI: 'SUI/USD',
  SEI: 'SEI/USD',
  TIA: 'TIA/USD',
  INJ: 'INJ/USD',
  FET: 'FET/USD',
  RNDR: 'RNDR/USD',
  ASTR: 'ASTR/USD',
  HYPE: 'HYPE/USD',
  TRUMP: 'TRUMP/USD',
  TAO: 'TAO/USD',
  PUMP: 'PUMP/USD',
  FARTCOIN: 'FARTCOIN/USD',
  BCH: 'BCH/USD',
  BONK: 'BONK/USD',
  AAVE: 'AAVE/USD',
  LDO: 'LDO/USD',
  KAS: 'KAS/USD',
  BNB: 'BNB/USD',
};

export function toKrakenPair(asset: string): string {
  return KRAKEN_MAP[asset] || `${asset}/USD`;
}

export function fromKrakenPair(pair: string): string | null {
  for (const [asset, krakenPair] of Object.entries(KRAKEN_MAP)) {
    if (krakenPair === pair) return asset;
  }
  return null;
}

export function getAllKrakenPairs(): string[] {
  return Object.values(KRAKEN_MAP);
}
