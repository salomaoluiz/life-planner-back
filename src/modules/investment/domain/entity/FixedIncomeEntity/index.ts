import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
} from '@investment/domain/enum';

// Dates are calendar days (`YYYY-MM-DD`); rates are decimal strings.
export interface FixedIncomeAdjustmentEntity {
  assetId: string;
  date: string;
  grossAmount: number;
  id: string;
}
export interface FixedIncomeData {
  adjustments: FixedIncomeAdjustmentEntity[];
  rates: FixedIncomeRateEntity[];
  terms: FixedIncomeTermsEntity | null;
}
export interface FixedIncomeRateEntity extends FixedIncomeRateWrite {
  assetId: string;
  id: string;
}
export interface FixedIncomeRateWrite {
  annualRate: null | string;
  cdiPercent: null | string;
  effectiveRate: string;
  indexRate: null | string;
  mode: InvestmentFixedIncomeRateMode;
  spread: null | string;
  startDate: string;
}
export interface FixedIncomeTermsEntity extends FixedIncomeTermsWrite {
  assetId: string;
}
export interface FixedIncomeTermsWrite {
  liquidity: InvestmentFixedIncomeLiquidity;
  liquidityDate: null | string;
  maturityDate: string;
  product: InvestmentFixedIncomeProduct;
  taxExempt: boolean;
}
