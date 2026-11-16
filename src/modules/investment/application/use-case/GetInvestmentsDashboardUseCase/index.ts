import { ForbiddenException, Inject } from '@nestjs/common';

import {
  GetInvestmentsDashboardInput,
  GetInvestmentsDashboardSchema,
} from '@investment/application/dto/Dashboard';
import {
  buildDashboard,
  incomeRangeEnd,
  InvestmentsDashboard,
} from '@investment/application/service/DashboardView';
import { FxCurve } from '@investment/application/service/PortfolioValuation';
import {
  emptyContext,
  QuoteContextLoader,
  USD_BRL,
} from '@investment/application/service/QuoteContext';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { AssetListRow } from '@investment/domain/entity/AssetEntity';
import { FxRateEntity } from '@investment/domain/entity/QuoteEntity';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import {
  IIncomeRepository,
  IInvestmentRepository,
  IQuoteRepository,
  QuoteKey,
} from '@investment/domain/repository';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 110 FR 6-10: the whole overview of the portfolio. Every data set is read ONCE (assets with their operations,
// quotes, valuations, closes of the period, the dollar, incomes), then the pure `buildDashboard` computes every
// point in memory: the number of queries does not depend on the number of assets or points.
export class GetInvestmentsDashboardUseCase implements UseCaseWithParams<
  GetInvestmentsDashboardInput,
  InvestmentsDashboard
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    @Inject('IQuoteRepository') private readonly quoteRepository: IQuoteRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  private async closes(rows: AssetListRow[], from: string, to: string) {
    const keys = new Map<string, QuoteKey>();

    for (const row of rows) {
      const market = marketOfClass(row.assetClass);

      if (market && row.ticker) {
        keys.set(`${market}:${row.ticker}`, { market, ticker: row.ticker });
      }
    }

    return keys.size === 0
      ? []
      : this.quoteRepository.findHistoryBatch([...keys.values()], from, to);
  }

  async execute(params: GetInvestmentsDashboardInput): Promise<InvestmentsDashboard> {
    const input = validate(GetInvestmentsDashboardSchema, params);
    const requested = new Set(input.ownerIds);
    const owners = input.accessibleOwners.filter((access) => requested.has(access.ownerId));

    if (owners.length < requested.size) {
      throw new ForbiddenException('You cannot read one of the requested owners');
    }

    const { from, to, today } = input;
    const rows = await this.investment.findAssetsByOwners(owners, InvestmentAssetStatus.ACTIVE);
    const base = { from, to, today };

    if (rows.length === 0) {
      return buildDashboard({
        ...base,
        closes: [],
        context: emptyContext(),
        fx: { current: null, rates: [] },
        incomes: [],
        rows: [],
        valuations: new Map(),
      });
    }

    const fxFrom = fxStart(rows, from);
    const [context, valuations, closes, fx, incomes] = await Promise.all([
      this.quotes.load(rows),
      this.investment.findValuationsByAssets(rows.map((row) => row.id)),
      this.closes(rows, from, to),
      this.fxHistory(fxFrom, to),
      this.incomes.findDashboardIncomes(owners, from, incomeRangeEnd(from, to, today)),
    ]);

    return buildDashboard({
      ...base,
      closes,
      context,
      fx: toCurve(fx, context.fx),
      incomes,
      rows,
      valuations,
    });
  }

  private async fxHistory(from: null | string, to: string) {
    if (from === null) {
      return { history: [], seed: undefined, start: null };
    }

    const [seed, history] = await Promise.all([
      this.quoteRepository.findFxOnOrBefore(USD_BRL, from),
      this.quoteRepository.findFxHistory(USD_BRL, from, to),
    ]);

    return { history, seed, start: from };
  }
}

// The dollar is read from the oldest USD operation (its rate is needed when it has none), never before the period start.
function fxStart(rows: AssetListRow[], from: string): null | string {
  const dates = rows
    .filter((row) => row.currency === 'USD')
    .flatMap((row) => row.operations.map((operation) => operation.date));

  return dates.length === 0 ? null : ([from, ...dates].sort()[0] ?? from);
}
// History + the seed rate of its start + the current quote as the last point (its calendar day in São Paulo).
function toCurve(
  data: {
    history: { date: string; rate: string }[];
    seed: string | undefined;
    start: null | string;
  },
  current: FxRateEntity | null,
): FxCurve {
  const rates = [
    ...(data.seed !== undefined && data.start !== null
      ? [{ date: data.start, rate: data.seed }]
      : []),
    ...data.history.map((row) => ({ date: row.date, rate: row.rate })),
  ];

  if (current) {
    rates.push({ date: todayInSaoPaulo(current.quotedAt), rate: current.rate });
  }

  return {
    current: current?.rate ?? null,
    rates: rates.sort((a, b) => a.date.localeCompare(b.date)),
  };
}
