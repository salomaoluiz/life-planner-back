import { InvestmentFixedIncomeRateMode, MarketIndexSeries } from '@investment/domain/enum';

// Spec 113: global market data (no owner). Dates are calendar days (`YYYY-MM-DD`), values decimal strings.
export interface MarketIndexFetchEntity {
  lastAttemptAt: Date | null;
  lastError: null | string;
  lastSuccessAt: Date | null;
  series: MarketIndexSeries;
}
export interface MarketIndexFollower {
  assetId: string;
  cdiPercent: null | string;
  mode: InvestmentFixedIncomeRateMode;
  name: string;
  spread: null | string;
}
export interface MarketIndexFxPair {
  pair: string;
  quotedAt: Date;
  rate: string;
}
export interface MarketIndexPoint {
  date: string;
  value: string;
}
export interface MarketIndexWrite {
  date: string;
  source: string;
  value: string;
}
