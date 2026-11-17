import { InvestmentAssetClass, InvestmentIncomeType } from '@investment/domain/enum';
import { ScheduledIncome } from '@investment/domain/service/IncomeSeriesSchedule';
import { suggestNet, withholdingBps } from '@investment/domain/service/IncomeWithholding';
import { Decimal8 } from '@shared/infra/decimal';

// Spec 115 FR 10-12: quantity and net amount of each occurrence from the position at its ex-date, and where a zero
// position ends the series.
export interface PlannedIncome extends ScheduledIncome {
  netAmount: number;
  quantity: string;
}
export interface SeriesPlan {
  // Occurrences that exist (before the first zero position).
  items: PlannedIncome[];
  // Payment date of the first occurrence with no position, when there is one.
  endsAt: null | string;
}

export function planOccurrences(params: {
  amountPerUnit: string;
  assetClass: InvestmentAssetClass;
  occurrences: ScheduledIncome[];
  // Position at the end of a date (operations dated on or before it).
  positionAt: (date: string) => Decimal8;
  type: InvestmentIncomeType;
}): SeriesPlan {
  const rate = withholdingBps(params.type, params.assetClass);
  const amount = Decimal8.parse(params.amountPerUnit);
  const items: PlannedIncome[] = [];

  for (const occurrence of params.occurrences) {
    const quantity = params.positionAt(occurrence.exDate);

    if (quantity.isZero()) {
      return { endsAt: occurrence.paymentDate, items };
    }

    items.push({
      ...occurrence,
      netAmount: suggestNet(quantity, amount, rate),
      quantity: quantity.toString(),
    });
  }

  return { endsAt: null, items };
}
