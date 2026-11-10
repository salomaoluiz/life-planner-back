import { InvestmentFixedIncomeRateMode } from '@investment/domain/enum';

export interface RateInput {
  annualRate?: null | string;
  cdiPercent?: null | string;
  indexRate?: null | string;
  mode: InvestmentFixedIncomeRateMode;
  spread?: null | string;
}

const BUSINESS_DAYS_PER_YEAR = 252;
const PLACES = 6;

// Spec 105 FR 7: the only rate (% per year, 6 places) the calculation uses.
export function effectiveRateOf(input: RateInput): string {
  switch (input.mode) {
    case InvestmentFixedIncomeRateMode.CDI_PERCENT: {
      const daily = Math.pow(1 + Number(input.indexRate) / 100, 1 / BUSINESS_DAYS_PER_YEAR) - 1;

      return fixed(
        (Math.pow(1 + (daily * Number(input.cdiPercent)) / 100, BUSINESS_DAYS_PER_YEAR) - 1) * 100,
      );
    }
    case InvestmentFixedIncomeRateMode.IPCA_PLUS:
      return fixed(
        ((1 + Number(input.indexRate) / 100) * (1 + Number(input.spread) / 100) - 1) * 100,
      );
    case InvestmentFixedIncomeRateMode.PREFIXED:
      return fixed(Number(input.annualRate));
  }
}

function fixed(value: number): string {
  return value.toFixed(PLACES);
}
