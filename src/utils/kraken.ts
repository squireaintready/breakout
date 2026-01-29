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
  PEPE: 'PEPE/USD',
  WIF: 'WIF/USD',
  FLOKI: 'FLOKI/USD',
  SHIB: 'SHIB/USD',
  FIL: 'FIL/USD',
  IMX: 'IMX/USD',
  GRT: 'GRT/USD',
  PENDLE: 'PENDLE/USD',
  JUP: 'JUP/USD',
  ENA: 'ENA/USD',
  ONDO: 'ONDO/USD',
  STX: 'STX/USD',
  MKR: 'MKR/USD',
  RENDER: 'RENDER/USD',
  TRX: 'TRX/USD',
  TON: 'TON/USD',
  XLM: 'XLM/USD',
  ALGO: 'ALGO/USD',
  VET: 'VET/USD',
  SAND: 'SAND/USD',
  MANA: 'MANA/USD',
  AXS: 'AXS/USD',
  CRV: 'CRV/USD',
  SNX: 'SNX/USD',
  COMP: 'COMP/USD',
  SUSHI: 'SUSHI/USD',
  DYDX: 'DYDX/USD',
  BLUR: 'BLUR/USD',
  W: 'W/USD',
  PYTH: 'PYTH/USD',
  JTO: 'JTO/USD',
  STRK: 'STRK/USD',
  MEME: 'MEME/USD',
  ORDI: 'ORDI/USD',
  RUNE: 'RUNE/USD',
  WLD: 'WLD/USD',
  FTM: 'FTM/USD',
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
