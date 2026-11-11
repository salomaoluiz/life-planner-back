import { Inject, Injectable } from '@nestjs/common';

import { IncomeEventUpsert, IncomeSuggestionInputs } from '@investment/domain/entity/IncomeEntity';
import { InvestmentIncomeType, InvestmentOperationType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { IIncomeRepository, IQuoteRepository } from '@investment/domain/repository';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import { MatcherAsset, matchSuggestions } from '@investment/domain/service/IncomeSuggestionMatcher';
import { addDays, marketDateOf } from '@investment/domain/service/MarketDate';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { UseCase } from '@shared/application/use-case/types';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import {
  IBrapiQuotes,
  IFinnhubQuotes,
  IncomeEventResult,
  QuoteSourceLimitError,
  QuoteSourceUnavailableError,
} from '@shared/infra/quotes/types';

// One advisory lock for the whole run, so two instances never fetch the same sources at the same time.
const LOCK_KEY = 107001;
const TRACK_WINDOW_DAYS = 30;
const LOOKBACK_DAYS = 400;

export interface RefreshIncomeEventsResult {
  created: number;
  fetched: number;
  skipped: boolean;
}

function toMatcherAsset(asset: IncomeSuggestionInputs['assets'][number]): MatcherAsset {
  const { operations } = asset;
  const step = unitStepOf(asset.assetClass);
  const buys = operations
    .filter((operation) => operation.type === InvestmentOperationType.BUY)
    .map((operation) => operation.date)
    .sort();

  return {
    firstBuyDate: buys[0] ?? null,
    id: asset.assetId,
    market: asset.market,
    positionAt: (date) =>
      calculatePosition(
        operations.filter((operation) => operation.date <= date),
        { step },
      ).quantity,
    ticker: asset.ticker,
  };
}

// Spec 107 FR 23-26: the only path that calls the providers for announced income. Reads never do.
@Injectable()
export class RefreshIncomeEventsUseCase implements UseCase<RefreshIncomeEventsResult> {
  constructor(
    @Inject('IQuoteRepository') private readonly quotes: IQuoteRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    @Inject('IBrapiQuotes') private readonly brapi: IBrapiQuotes,
    @Inject('IFinnhubQuotes') private readonly finnhub: IFinnhubQuotes,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  async execute(): Promise<RefreshIncomeEventsResult> {
    const result: RefreshIncomeEventsResult = { created: 0, fetched: 0, skipped: false };
    const ran = await this.incomes.runExclusive(LOCK_KEY, async () => {
      const now = new Date();
      const today = marketDateOf(now, QuoteMarket.B3);
      const tracked = await this.quotes.findTrackedSymbols(addDays(today, -TRACK_WINDOW_DAYS));
      const keys = tracked.map(({ market, ticker }) => ({ market, ticker }));
      const rows = await this.fetchEvents(keys, now);
      result.fetched = (await this.incomes.upsertEvents(rows)).length;
      result.created = await this.suggest(keys, today);
    });
    result.skipped = !ran;
    return result;
  }
  // A source without token or endpoint gives no events; a failing source is logged once per run and skipped.
  private async fetchEvents(
    keys: { market: QuoteMarket; ticker: string }[],
    fetchedAt: Date,
  ): Promise<IncomeEventUpsert[]> {
    const rows: IncomeEventUpsert[] = [];
    const stopped = new Set<QuoteMarket>();
    for (const { market, ticker } of keys) {
      if (stopped.has(market)) {
        continue;
      }
      try {
        const source = market === QuoteMarket.B3 ? 'brapi' : 'finnhub';
        const events: IncomeEventResult[] =
          market === QuoteMarket.B3
            ? await this.brapi.getIncomeEvents(ticker)
            : await this.finnhub.getIncomeEvents(ticker);
        for (const event of events) {
          rows.push({
            amountPerUnit: event.amountPerUnit,
            currency: event.currency,
            eventKey: `${source}:${ticker}:${event.type}:${event.exDate}`,
            exDate: event.exDate,
            fetchedAt,
            market,
            paymentDate: event.paymentDate,
            source,
            ticker,
            type: event.type as InvestmentIncomeType,
          });
        }
      } catch (error) {
        stopped.add(market);
        if (!(error instanceof QuoteSourceUnavailableError)) {
          this.logger.log(LogLevel.WARN, 'Income events source failed for this run', {
            limit: error instanceof QuoteSourceLimitError,
            market,
            module: 'RefreshIncomeEventsUseCase',
          });
        }
      }
    }
    return rows;
  }

  private async suggest(
    keys: { market: QuoteMarket; ticker: string }[],
    today: string,
  ): Promise<number> {
    const [inputs, events] = await Promise.all([
      this.incomes.findSuggestionInputs(keys),
      this.incomes.findEvents(keys, addDays(today, -LOOKBACK_DAYS)),
    ]);
    const suggestions = matchSuggestions({
      assets: inputs.assets.map((asset) => toMatcherAsset(asset)),
      events,
      existing: new Set(inputs.existing),
      incomes: inputs.incomes,
      today,
    });
    return this.incomes.createSuggestions(
      suggestions.map((suggestion) => ({
        assetId: suggestion.assetId,
        eventId: suggestion.eventId,
        quantity: suggestion.quantity.toString(),
      })),
    );
  }
}
