import { InvestmentAssetClass, InvestmentIncomeType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

const BASIS = 10000;

export interface IncomeEstimate {
  gross: number;
  withheld: number;
}

// Spec 107 FR 2: the type the form starts with, per asset class (the owner can pick any type).
export function defaultIncomeType(assetClass: InvestmentAssetClass): InvestmentIncomeType {
  if (assetClass === InvestmentAssetClass.BR_REIT) {
    return InvestmentIncomeType.YIELD;
  }

  return assetClass === InvestmentAssetClass.FIXED_INCOME
    ? InvestmentIncomeType.INTEREST
    : InvestmentIncomeType.DIVIDEND;
}

// Spec 107 FR 6: `gross = round(net / (1 - rate))`, display only. A rate of 0 returns the net as the gross.
export function estimateIncome(net: number, rateBps: number): IncomeEstimate {
  if (rateBps <= 0) {
    return { gross: net, withheld: 0 };
  }

  const gross = Math.round((net * BASIS) / (BASIS - rateBps));

  return { gross, withheld: gross - net };
}

// Spec 107 FR 4: `net = round(quantity x amountPerUnit x (1 - rate))` in minor units.
export function suggestNet(quantity: Decimal8, amountPerUnit: Decimal8, rateBps: number): number {
  return Math.round((quantity.mulToCents(amountPerUnit) * (BASIS - rateBps)) / BASIS);
}

// The only place of the estimated withholding table (spec 107 FR 6, section 13). In basis points of the gross.
export function withholdingBps(
  type: InvestmentIncomeType,
  assetClass: InvestmentAssetClass,
): number {
  if (type === InvestmentIncomeType.JCP) {
    return 1500;
  }

  return type === InvestmentIncomeType.DIVIDEND && assetClass === InvestmentAssetClass.FOREIGN_STOCK
    ? 3000
    : 0;
}

// "0.15" for the API.
export function bpsToRate(bps: number): string {
  return (bps / BASIS).toFixed(4).replace(/\.?0+$/, '') || '0';
}
