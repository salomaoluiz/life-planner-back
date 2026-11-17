import {
  FixedIncomeAdjustmentEntity,
  FixedIncomeData,
  FixedIncomeRateEntity,
} from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
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
import {
  currentCdiEffective,
  currentIpcaEffective,
  EMPTY_INDEXES,
  hasIndexFor,
  IndexSeriesData,
} from '@investment/domain/service/IndexSeries';
import { Decimal8 } from '@shared/infra/decimal';

const ONE = Decimal8.parse('1');

export interface FixedIncomeView {
  adjustments: FixedIncomeAdjustmentEntity[];
  atMaturity: Totals;
  currentEffectiveRate: null | string;
  // Spec 113 FR 14: an indexed rate with no stored series at all; the API then answers no totals.
  indexMissing: boolean;
  liquidity: InvestmentFixedIncomeLiquidity;
  liquidityDate: null | string;
  lots: LotResult[];
  maturityDate: string;
  maturityPending: boolean;
  // Spec 113 FR 16: a redemption that no longer fits the recalculated curve (it is kept, the owner reviews it).
  needsReview: { date: string; operationId: string } | null;
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
  indexes?: IndexSeriesData,
): CalcInput {
  return {
    adjustments: data.adjustments.map((row) => ({ date: row.date, grossAmount: row.grossAmount })),
    indexes,
    lots: operations
      .filter((operation) => operation.type === InvestmentOperationType.BUY)
      .map((operation) => ({
        date: operation.date,
        operationId: operation.id,
        principal: operation.quantity.mulToCents(ONE),
      })),
    on,
    rates: data.rates.map((row) => ({
      cdiPercent: row.cdiPercent === null ? undefined : Number(row.cdiPercent),
      effectiveRate: Number(row.effectiveRate),
      mode: row.mode,
      spread: row.spread === null ? undefined : Number(row.spread),
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
  indexes: IndexSeriesData = EMPTY_INDEXES,
): FixedIncomeView | null {
  if (!data?.terms) {
    return null;
  }

  const full = { ...data, terms: data.terms };
  // Oldest first: the repository sends newest first and the calculator replays in date order.
  const ordered = [...operations].reverse();
  const now = calculateTitle(toCalcInput(full, ordered, today, indexes));
  const atMaturity = projectAtMaturity(toCalcInput(full, ordered, today, indexes));
  const rates = [...data.rates].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return {
    adjustments: data.adjustments,
    atMaturity: atMaturity.totals,
    currentEffectiveRate: currentRateOf(rates, today, indexes),
    indexMissing: rates.some(
      (rate) =>
        rate.mode !== InvestmentFixedIncomeRateMode.PREFIXED && !hasIndexFor(indexes, rate.mode),
    ),
    liquidity: data.terms.liquidity,
    liquidityDate: data.terms.liquidityDate,
    lots: now.lots,
    maturityDate: data.terms.maturityDate,
    maturityPending: data.terms.maturityDate <= today && now.remainingPrincipal > 0,
    needsReview: now.error ? { date: now.error.date, operationId: now.error.operationId } : null,
    product: data.terms.product,
    rates,
    taxExempt: data.terms.taxExempt,
    today: now.totals,
  };
}

// Spec 113 FR 10: the annual rate of the entry in force; an indexed one follows the latest stored index.
function currentRateOf(
  rates: FixedIncomeRateEntity[],
  today: string,
  indexes: IndexSeriesData,
): null | string {
  const started = rates.filter((rate) => rate.startDate <= today);
  const rate = started[started.length - 1] ?? rates[0];

  if (!rate) {
    return null;
  }
  if (rate.mode === InvestmentFixedIncomeRateMode.CDI_PERCENT) {
    return currentCdiEffective(indexes, Number(rate.cdiPercent)) ?? rate.effectiveRate;
  }
  if (rate.mode === InvestmentFixedIncomeRateMode.IPCA_PLUS) {
    return currentIpcaEffective(indexes, Number(rate.spread)) ?? rate.effectiveRate;
  }

  return rate.effectiveRate;
}
