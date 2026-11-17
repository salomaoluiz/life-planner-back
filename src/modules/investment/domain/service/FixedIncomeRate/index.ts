import { InvestmentFixedIncomeRateMode } from '@investment/domain/enum';
import {
  currentCdiEffective,
  currentIpcaEffective,
  EMPTY_INDEXES,
  IndexSeriesData,
} from '@investment/domain/service/IndexSeries';

export interface RateInput {
  annualRate?: null | string;
  cdiPercent?: null | string;
  mode: InvestmentFixedIncomeRateMode;
  spread?: null | string;
}

const PLACES = 6;

// Spec 105 FR 7 and spec 113 FR 10: the rate (% per year, 6 places) shown for an entry. An indexed entry follows the
// stored series (CDI: the latest daily CDI; IPCA + x: the Focus expectation) and is only a snapshot, `0` without them.
export function effectiveRateOf(
  input: RateInput,
  indexes: IndexSeriesData = EMPTY_INDEXES,
): string {
  switch (input.mode) {
    case InvestmentFixedIncomeRateMode.CDI_PERCENT:
      return currentCdiEffective(indexes, Number(input.cdiPercent)) ?? fixed(0);
    case InvestmentFixedIncomeRateMode.IPCA_PLUS:
      return currentIpcaEffective(indexes, Number(input.spread)) ?? fixed(0);
    case InvestmentFixedIncomeRateMode.PREFIXED:
      return fixed(Number(input.annualRate));
  }
}

function fixed(value: number): string {
  return value.toFixed(PLACES);
}
