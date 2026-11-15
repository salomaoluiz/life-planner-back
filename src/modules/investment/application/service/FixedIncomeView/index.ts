import {
  FixedIncomeAdjustmentEntity,
  FixedIncomeData,
  FixedIncomeRateEntity,
} from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
} from '@investment/domain/enum';
import {
  calculateTitle,
  LotResult,
  projectAtMaturity,
  Totals,
} from '@investment/domain/service/FixedIncomeCalculator';
import { toCalcInput } from '@investment/domain/service/FixedIncomeCalculator/input';

export { toCalcInput };

export interface FixedIncomeView {
  adjustments: FixedIncomeAdjustmentEntity[];
  atMaturity: Totals;
  currentEffectiveRate: null | string;
  liquidity: InvestmentFixedIncomeLiquidity;
  liquidityDate: null | string;
  lots: LotResult[];
  maturityDate: string;
  maturityPending: boolean;
  product: InvestmentFixedIncomeProduct;
  rates: FixedIncomeRateEntity[];
  taxExempt: boolean;
  today: Totals;
}

// FR 26: the computed numbers of a calculated title, `null` for any other asset.
export function toFixedIncomeView(
  data: FixedIncomeData | undefined,
  operations: OperationEntity[],
  today: string,
): FixedIncomeView | null {
  if (!data?.terms) {
    return null;
  }

  const full = { ...data, terms: data.terms };
  // Oldest first: the repository sends newest first and the calculator replays in date order.
  const ordered = [...operations].reverse();
  const now = calculateTitle(toCalcInput(full, ordered, today));
  const atMaturity = projectAtMaturity(toCalcInput(full, ordered, today));
  const rates = [...data.rates].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return {
    adjustments: data.adjustments,
    atMaturity: atMaturity.totals,
    currentEffectiveRate: currentRateOf(rates, today),
    liquidity: data.terms.liquidity,
    liquidityDate: data.terms.liquidityDate,
    lots: now.lots,
    maturityDate: data.terms.maturityDate,
    maturityPending: data.terms.maturityDate <= today && now.remainingPrincipal > 0,
    product: data.terms.product,
    rates,
    taxExempt: data.terms.taxExempt,
    today: now.totals,
  };
}

function currentRateOf(rates: FixedIncomeRateEntity[], today: string): null | string {
  const started = rates.filter((rate) => rate.startDate <= today);

  return (started[started.length - 1] ?? rates[0])?.effectiveRate ?? null;
}
