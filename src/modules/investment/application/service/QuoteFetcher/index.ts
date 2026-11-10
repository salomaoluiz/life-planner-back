import { Inject, Injectable } from '@nestjs/common';

import { FxRateEntity, QuoteUpsert, TrackedSymbol } from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';
import { IQuoteRepository } from '@investment/domain/repository';
import { marketDateOf } from '@investment/domain/service/MarketDate';
import { Decimal8 } from '@shared/infra/decimal';
import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import {
  IBrapiQuotes,
  IFinnhubQuotes,
  IFxRates,
  QuoteResult,
  QuoteSourceUnavailableError,
} from '@shared/infra/quotes/types';

import { USD_BRL } from '../QuoteContext';

export interface MarketOutcome {
  failed: string[];
  fetched: number;
}

const CURRENCY: Record<QuoteMarket, string> = { [QuoteMarket.B3]: 'BRL', [QuoteMarket.US]: 'USD' };
const SOURCE: Record<QuoteMarket, QuoteSource> = {
  [QuoteMarket.B3]: QuoteSource.BRAPI,
  [QuoteMarket.US]: QuoteSource.FINNHUB,
};

// Oldest `fetched_at` first (never fetched first, ties by ticker), so a run that stops early leaves the symbols
// it skipped at the front of the next one (spec 104 FR 7).
export function sortOldestFirst(symbols: TrackedSymbol[]): TrackedSymbol[] {
  return [...symbols].sort((a, b) => {
    const left = a.fetchedAt?.getTime() ?? -Infinity;
    const right = b.fetchedAt?.getTime() ?? -Infinity;

    if (left === right) {
      return a.ticker.localeCompare(b.ticker);
    }

    return left < right ? -1 : 1;
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}
// Prices reach the database with exactly 8 places, whatever notation the API used.
function normalizePrice(value: string): string {
  return Number(value).toFixed(8);
}
function optionalPrice(value: null | string): null | string {
  return value === null ? null : normalizePrice(value);
}

@Injectable()
export class QuoteFetcher {
  constructor(
    @Inject('IBrapiQuotes') private readonly brapi: IBrapiQuotes,
    @Inject('IFinnhubQuotes') private readonly finnhub: IFinnhubQuotes,
    @Inject('IFxRates') private readonly fx: IFxRates,
    @Inject('IQuoteRepository') private readonly repository: IQuoteRepository,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
  ) {}

  // USD-BRL: the latest rate and today's history row. A failure keeps the previous rate and logs one warning.
  async fetchFx(now: Date): Promise<FxRateEntity | null> {
    try {
      const quote = await this.fx.getUsdBrl();
      const rate = {
        pair: USD_BRL,
        quotedAt: quote.quotedAt,
        rate: quote.rate,
        source: quote.source,
      };

      await this.repository.saveFx(rate);
      await this.repository.saveFxHistory([
        {
          date: marketDateOf(quote.quotedAt, QuoteMarket.B3),
          pair: USD_BRL,
          rate: quote.rate,
          source: quote.source,
        },
      ]);

      return rate;
    } catch (error) {
      this.warn('fx', 1, error, now);

      return null;
    }
  }

  // Sequential batches, oldest first. A failing batch stops this source for the run (FR 7); its symbols get
  // `last_error_at`, the ones after it keep their old `fetched_at`.
  async fetchMarket(
    market: QuoteMarket,
    symbols: TrackedSymbol[],
    options: { closeRun: boolean; now: Date },
  ): Promise<MarketOutcome> {
    const { closeRun, now } = options;
    const size = market === QuoteMarket.B3 ? this.env.investmentQuotesBrapiBatchSize : 1;
    const outcome: MarketOutcome = { failed: [], fetched: 0 };

    for (const batch of chunk(sortOldestFirst(symbols), size)) {
      const tickers = batch.map((symbol) => symbol.ticker);
      let results: QuoteResult[];

      try {
        results = await this.source(market).getQuotes(tickers);
      } catch (error) {
        if (!(error instanceof QuoteSourceUnavailableError)) {
          outcome.failed.push(...tickers);
          await this.repository.markQuoteErrors(
            tickers.map((ticker) => ({ market, ticker })),
            now,
          );
        }

        this.warn(market, symbols.length, error, now);

        return outcome;
      }

      const returned = results.filter((result) => tickers.includes(result.ticker));

      await this.save(market, returned, now);
      outcome.fetched += returned.length;

      if (closeRun) {
        const seen = new Set(returned.map((result) => result.ticker));
        const missing = tickers.filter((ticker) => !seen.has(ticker));

        await this.repository.markMissing(missing.map((ticker) => ({ market, ticker })));
      }
    }

    return outcome;
  }

  // The latest quote and today's history row (the close run just leaves the last one of the day).
  async save(market: QuoteMarket, results: QuoteResult[], now: Date): Promise<void> {
    if (results.length === 0) {
      return;
    }

    const rows: QuoteUpsert[] = results.map((result) => ({
      changePercent: result.changePercent === null ? null : Number(result.changePercent).toFixed(4),
      currency: CURRENCY[market],
      dayHigh: optionalPrice(result.dayHigh),
      dayLow: optionalPrice(result.dayLow),
      logoUrl: result.logoUrl,
      market,
      name: result.name,
      previousClose: optionalPrice(result.previousClose),
      price: normalizePrice(result.price),
      quotedAt: result.quotedAt,
      source: SOURCE[market],
      ticker: result.ticker,
    }));

    await this.repository.saveQuotes(rows, now);
    await this.repository.saveHistory(
      rows.map((row) => ({
        close: Decimal8.parse(row.price),
        date: marketDateOf(row.quotedAt, market),
        market,
        source: SOURCE[market],
        ticker: row.ticker,
      })),
    );
  }

  private source(market: QuoteMarket): IBrapiQuotes | IFinnhubQuotes {
    return market === QuoteMarket.B3 ? this.brapi : this.finnhub;
  }

  // One warning per source and run; never the token, never an owner.
  private warn(source: string, symbols: number, error: unknown, now: Date): void {
    this.logger.log(LogLevel.WARN, `Quote source ${source} failed`, {
      at: now.toISOString(),
      error: error instanceof Error ? error.message : 'unknown',
      module: 'QuoteFetcher',
      symbols,
    });
  }
}
