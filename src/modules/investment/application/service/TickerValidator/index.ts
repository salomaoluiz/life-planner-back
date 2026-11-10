import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { HistoryBackfill } from '@investment/application/service/HistoryBackfill';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';
import { IBrapiQuotes, IFinnhubQuotes, QuoteResult } from '@shared/infra/quotes/types';

export const TICKER_NOT_FOUND_CODE = 'TICKER_NOT_FOUND';
export const SOURCE_UNAVAILABLE_CODE = 'QUOTE_SOURCE_UNAVAILABLE';

export function sourceUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: SOURCE_UNAVAILABLE_CODE,
    message: 'The quote source is unavailable. Try again in a moment.',
  });
}

// Spec 104 FR 25: a ticker of a quoted class must exist at the market source. A valid one also stores its first
// quote right away and queues the history backfill, so the asset has a price before the next hourly run.
@Injectable()
export class TickerValidator {
  constructor(
    @Inject('IBrapiQuotes') private readonly brapi: IBrapiQuotes,
    @Inject('IFinnhubQuotes') private readonly finnhub: IFinnhubQuotes,
    private readonly fetcher: QuoteFetcher,
    private readonly backfill: HistoryBackfill,
  ) {}

  async validate(assetClass: string, ticker: null | string): Promise<void> {
    const market = marketOfClass(assetClass);

    if (!market || !ticker) {
      return;
    }

    let results: QuoteResult[];

    try {
      results = await (market === QuoteMarket.B3 ? this.brapi : this.finnhub).getQuotes([ticker]);
    } catch {
      throw sourceUnavailable();
    }

    const found = results.filter((result) => result.ticker === ticker);

    if (found.length === 0) {
      throw new UnprocessableEntityException({
        code: TICKER_NOT_FOUND_CODE,
        message: `No asset found for "${ticker}". Check the ticker or use the Non-listed class.`,
      });
    }

    await this.fetcher.save(market, found, new Date());
    this.backfill.queue(market, ticker);
  }
}
