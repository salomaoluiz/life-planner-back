import { Inject, Injectable } from '@nestjs/common';

import { PriceHistoryRow } from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';
import { IQuoteRepository } from '@investment/domain/repository';
import { Decimal8 } from '@shared/infra/decimal';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IBrapiQuotes } from '@shared/infra/quotes/types';

const BACKFILL_RANGE = '3mo';

// Spec 104 FR 14: a B3 ticker with no history gets the free-tier range of daily closes, after the response.
// US symbols get none (Finnhub's free plan has no daily history); their chart starts at the first close run.
@Injectable()
export class HistoryBackfill {
  constructor(
    @Inject('IBrapiQuotes') private readonly brapi: IBrapiQuotes,
    @Inject('IQuoteRepository') private readonly repository: IQuoteRepository,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  queue(market: QuoteMarket, ticker: string): void {
    if (market !== QuoteMarket.B3) {
      return;
    }

    setImmediate(() => {
      this.run(ticker).catch((error: unknown) => {
        this.logger.log(LogLevel.WARN, 'History backfill failed', {
          error: error instanceof Error ? error.message : 'unknown',
          module: 'HistoryBackfill',
        });
      });
    });
  }

  async run(ticker: string): Promise<number> {
    if (await this.repository.hasHistory(QuoteMarket.B3, ticker)) {
      return 0;
    }

    const closes = await this.brapi.getDailyHistory(ticker, BACKFILL_RANGE);
    const rows: PriceHistoryRow[] = closes.map((close) => ({
      close: Decimal8.parse(Number(close.close).toFixed(8)),
      date: close.date,
      market: QuoteMarket.B3,
      source: QuoteSource.BRAPI,
      ticker,
    }));

    await this.repository.saveHistory(rows);

    return rows.length;
  }
}
