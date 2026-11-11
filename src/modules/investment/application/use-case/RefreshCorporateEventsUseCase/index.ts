import { Inject, Injectable } from '@nestjs/common';

import {
  CorporateEventUpsert,
  EventSuggestionInputs,
} from '@investment/domain/entity/CorporateEventEntity';
import { InvestmentCorporateEventType, isEventType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { ICorporateEventRepository, IQuoteRepository } from '@investment/domain/repository';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import {
  CorporateMatcherAsset,
  matchEventSuggestions,
} from '@investment/domain/service/CorporateEventSuggestionMatcher';
import { addDays, marketDateOf } from '@investment/domain/service/MarketDate';
import { calculatePosition } from '@investment/domain/service/PositionCalculator';
import { UseCase } from '@shared/application/use-case/types';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import {
  CorporateEventResult,
  IBrapiQuotes,
  IFinnhubQuotes,
  QuoteSourceLimitError,
  QuoteSourceUnavailableError,
} from '@shared/infra/quotes/types';

// One advisory lock for the whole run, so two instances never fetch the same sources at the same time.
const LOCK_KEY = 108001;
const TRACK_WINDOW_DAYS = 30;
const LOOKBACK_DAYS = 400;

export interface RefreshCorporateEventsResult {
  created: number;
  fetched: number;
  skipped: boolean;
}

function toMatcherAsset(asset: EventSuggestionInputs['assets'][number]): CorporateMatcherAsset {
  const { operations } = asset;
  const step = unitStepOf(asset.assetClass);
  const buys = operations
    .filter((operation) => operation.type === 'BUY')
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

// Spec 108 FR 22-25: the second step of the events run, after 107's income step. The only path that calls the
// providers for corporate events; reads never do.
@Injectable()
export class RefreshCorporateEventsUseCase implements UseCase<RefreshCorporateEventsResult> {
  constructor(
    @Inject('IQuoteRepository') private readonly quotes: IQuoteRepository,
    @Inject('ICorporateEventRepository') private readonly events: ICorporateEventRepository,
    @Inject('IBrapiQuotes') private readonly brapi: IBrapiQuotes,
    @Inject('IFinnhubQuotes') private readonly finnhub: IFinnhubQuotes,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  async execute(): Promise<RefreshCorporateEventsResult> {
    const result: RefreshCorporateEventsResult = { created: 0, fetched: 0, skipped: false };
    const ran = await this.events.runExclusive(LOCK_KEY, async () => {
      const now = new Date();
      const today = marketDateOf(now, QuoteMarket.B3);
      const tracked = await this.quotes.findTrackedSymbols(addDays(today, -TRACK_WINDOW_DAYS));
      const keys = tracked.map(({ market, ticker }) => ({ market, ticker }));

      result.fetched = await this.events.upsertEvents(await this.fetchEvents(keys, now));
      result.created = await this.suggest(keys, today);
    });

    result.skipped = !ran;

    return result;
  }

  // A source without token or endpoint gives no events; a failing source is logged once per run and skipped.
  private async fetchEvents(
    keys: { market: QuoteMarket; ticker: string }[],
    fetchedAt: Date,
  ): Promise<CorporateEventUpsert[]> {
    const rows: CorporateEventUpsert[] = [];
    const stopped = new Set<QuoteMarket>();

    for (const { market, ticker } of keys) {
      if (stopped.has(market)) {
        continue;
      }

      try {
        const source = market === QuoteMarket.B3 ? 'brapi' : 'finnhub';
        const events: CorporateEventResult[] =
          market === QuoteMarket.B3
            ? await this.brapi.getCorporateEvents(ticker)
            : await this.finnhub.getCorporateEvents(ticker);

        for (const event of events) {
          rows.push({
            bonusPercent: event.bonusPercent ?? null,
            bonusUnitCost: event.bonusUnitCost ?? null,
            currency: event.currency,
            eventKey: `${source}:${ticker}:${event.type}:${event.recordDate}`,
            fetchedAt,
            market,
            ratioFrom: event.ratioFrom ?? null,
            ratioTo: event.ratioTo ?? null,
            recordDate: event.recordDate,
            source,
            ticker,
            type: event.type as InvestmentCorporateEventType,
          });
        }
      } catch (error) {
        stopped.add(market);

        if (!(error instanceof QuoteSourceUnavailableError)) {
          this.logger.log(LogLevel.WARN, 'Corporate events source failed for this run', {
            limit: error instanceof QuoteSourceLimitError,
            market,
            module: 'RefreshCorporateEventsUseCase',
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
      this.events.findSuggestionInputs(keys),
      this.events.findEvents(keys, addDays(today, -LOOKBACK_DAYS)),
    ]);
    const suggestions = matchEventSuggestions({
      assets: inputs.assets.map((asset) => toMatcherAsset(asset)),
      entered: inputs.assets.flatMap((asset) =>
        asset.operations
          .filter((operation) => isEventType(operation.type))
          .map((operation) => ({
            assetId: asset.assetId,
            date: operation.date,
            type: InvestmentCorporateEventType[
              operation.type as keyof typeof InvestmentCorporateEventType
            ],
          })),
      ),
      events,
      existing: new Set(inputs.existing),
      today,
    });

    return this.events.createSuggestions(
      suggestions.map((suggestion) => ({
        assetId: suggestion.assetId,
        eventId: suggestion.eventId,
        quantity: suggestion.quantity.toString(),
      })),
    );
  }
}
