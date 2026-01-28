import { BTC_ETH_ASSETS } from './constants';

export interface SizingInput {
  asset: string;
  entryPrice: number;
  stopLoss: number;
  riskPct: number;
  balance: number;
  btcEthLeverage: number;
  altLeverage: number;
  side: 'long' | 'short';
  tradingFeePct: number;
}

export interface SizingResult {
  stopDistancePct: number;
  sizeFromRisk: number;
  sizeFromLeverage: number;
  recommendedSize: number;
  dollarRisk: number;
  notionalValue: number;
  leverageUsed: number;
  estimatedLiquidationPrice: number;
  entryFee: number;
  exitFee: number;
  totalFees: number;
}

export function calculatePositionSize(input: SizingInput): SizingResult {
  const { asset, entryPrice, stopLoss, riskPct, balance, btcEthLeverage, altLeverage, side, tradingFeePct } = input;
  const maxLeverage = BTC_ETH_ASSETS.includes(asset) ? btcEthLeverage : altLeverage;

  const stopDistancePct = Math.abs(entryPrice - stopLoss) / entryPrice * 100;
  const dollarRisk = balance * (riskPct / 100);

  // Size from risk: dollarRisk = size * stopDistancePct / 100
  // But also account for entry+exit fees: dollarRisk = size * (stopDistancePct/100) + size * 2 * (tradingFeePct/100)
  const effectiveStopPct = stopDistancePct / 100 + 2 * (tradingFeePct / 100);
  const sizeFromRisk = dollarRisk / effectiveStopPct;

  // Size from leverage cap
  const sizeFromLeverage = balance * maxLeverage;

  const recommendedSize = Math.min(sizeFromRisk, sizeFromLeverage);
  const actualDollarRisk = recommendedSize * effectiveStopPct;
  const leverageUsed = recommendedSize / balance;

  const entryFee = recommendedSize * (tradingFeePct / 100);
  const exitFee = recommendedSize * (tradingFeePct / 100);
  const totalFees = entryFee + exitFee;

  // Estimated liquidation: assume 100% margin loss
  // For long: liq = entry * (1 - 1/leverage)
  // For short: liq = entry * (1 + 1/leverage)
  const estimatedLiquidationPrice = side === 'long'
    ? entryPrice * (1 - 1 / Math.max(leverageUsed, 1))
    : entryPrice * (1 + 1 / Math.max(leverageUsed, 1));

  return {
    stopDistancePct,
    sizeFromRisk,
    sizeFromLeverage,
    recommendedSize,
    dollarRisk: actualDollarRisk,
    notionalValue: recommendedSize,
    leverageUsed,
    estimatedLiquidationPrice,
    entryFee,
    exitFee,
    totalFees,
  };
}
