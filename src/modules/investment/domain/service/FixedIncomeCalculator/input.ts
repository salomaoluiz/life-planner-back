import { FixedIncomeData } from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import {
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { CalcInput } from './index';

const ONE = Decimal8.parse('1');

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
