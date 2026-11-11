import { ForbiddenException, Inject } from '@nestjs/common';

import {
  GetInvestmentsHomeSummaryInput,
  GetInvestmentsHomeSummarySchema,
} from '@investment/application/dto/HomeSummary';
import { toAssetView } from '@investment/application/service/AssetView';
import {
  Holding,
  NextMaturity,
  pickNextMaturity,
  summarizeHoldings,
  sumReceivedIncome,
  toHolding,
} from '@investment/application/service/HomeSummary';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface InvestmentsHomeSummary {
  currency: 'BRL';
  currentValueCents: number;
  hasPositions: boolean;
  income: { count: number; month: string; pendingSuggestions: number; totalCents: number };
  investedCents: number;
  nextMaturity: NextMaturity | null;
  quotes: { asOf: Date | null; manualCount: number; stale: boolean; withoutPrice: number };
  resultBasisPoints: null | number;
  resultCents: number;
}

// Spec 109 FR 14-17: the whole home section in BRL. Positions, quotes, FX and fixed income come from the same
// views as the asset list; quotes are the stored ones (no provider call), so `stale` reflects their age.
export class GetInvestmentsHomeSummaryUseCase implements UseCaseWithParams<
  GetInvestmentsHomeSummaryInput,
  InvestmentsHomeSummary
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: GetInvestmentsHomeSummaryInput): Promise<InvestmentsHomeSummary> {
    const input = validate(GetInvestmentsHomeSummarySchema, params);
    const requested = new Set(input.ownerIds);
    const owners = input.accessibleOwners.filter((access) => requested.has(access.ownerId));

    if (owners.length < requested.size) {
      throw new ForbiddenException('You cannot read one of the requested owners');
    }

    const month = input.today.slice(0, 7);
    const rows = await this.investment.findAssetsByOwners(owners, InvestmentAssetStatus.ACTIVE);

    if (rows.length === 0) {
      return summaryOf([], null, month, { count: 0, pendingSuggestions: 0, totalCents: 0 });
    }

    const [context, received, pendingSuggestions] = await Promise.all([
      this.quotes.load(rows),
      this.incomes.findReceivedByOwners(owners, `${month}-01`, `${month}-${lastDayOf(month)}`),
      this.incomes.countPendingSuggestionsByAssets(rows.map((row) => row.id)),
    ]);
    const fxRate = context.fx?.rate ?? null;
    const views = rows.map((row) => toAssetView(row, context));
    const holdings = views
      .map((view) => toHolding(view, fxRate))
      .filter((holding): holding is Holding => holding !== null);

    return summaryOf(holdings, pickNextMaturity(views, input.today), month, {
      ...sumReceivedIncome(received, fxRate),
      pendingSuggestions,
    });
  }
}

function lastDayOf(month: string): string {
  const [year, number] = month.split('-').map(Number);

  return String(new Date(Date.UTC(year ?? 0, number ?? 0, 0)).getUTCDate()).padStart(2, '0');
}
function summaryOf(
  holdings: Holding[],
  nextMaturity: NextMaturity | null,
  month: string,
  income: { count: number; pendingSuggestions: number; totalCents: number },
): InvestmentsHomeSummary {
  const totals = summarizeHoldings(holdings);

  return {
    currency: 'BRL',
    currentValueCents: totals.currentValueCents,
    hasPositions: holdings.length > 0,
    income: { ...income, month },
    investedCents: totals.investedCents,
    nextMaturity,
    quotes: {
      asOf: totals.quotesAsOf,
      manualCount: totals.manualCount,
      stale: totals.stale,
      withoutPrice: totals.withoutPrice,
    },
    resultBasisPoints: totals.resultBasisPoints,
    resultCents: totals.resultCents,
  };
}
