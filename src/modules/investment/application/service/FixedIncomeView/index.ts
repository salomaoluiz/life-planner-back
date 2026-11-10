import {
  FixedIncomeAdjustmentEntity,
  FixedIncomeData,
  FixedIncomeRateEntity,
} from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import {
  CalcInput,
  calculateTitle,
  LotResult,
  projectAtMaturity,
  Totals,
} from '@investment/domain/service/FixedIncomeCalculator';
import { Decimal8 } from '@shared/infra/decimal';

const ONE = Decimal8.parse('1');

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

// Spec 105 FR 13, 19: BUY rows are lots (principal = the quantity in reais, in cents), SELL rows are redemptions.
export function toCalcInput(
  data: { terms: NonNullable<FixedIncomeData['terms']> } & FixedIncomeData,
  operations: OperationEntity[],
  on: string,
): CalcInput {
  return {
    adjustments: data.adjustments.map((row) => ({ date: row.date, grossAmount: row.grossAmount })),
    lots: operations
      .filter((operation) => operation.type === InvestmentOperationType.BUY)
      .map((operation) => ({
        date: operation.date,
        operationId: operation.id,
        principal: operation.quantity.mulToCents(ONE),
      })),
    on,
    rates: data.rates.map((row) => ({
      effectiveRate: Number(row.effectiveRate),
      startDate: row.startDate,
    })),
    redemptions: operations
      .filter((operation) => operation.type === InvestmentOperationType.SELL)
      .map((operation) => ({
        date: operation.date,
        kind: operation.redemptionKind ?? InvestmentFixedIncomeRedemptionKind.PARTIAL,
        netAmount: operation.netAmount ?? operation.total,
        operationId: operation.id,
      })),
    terms: { maturityDate: data.terms.maturityDate, taxExempt: data.terms.taxExempt },
  };
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
