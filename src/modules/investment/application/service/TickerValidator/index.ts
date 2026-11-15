import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { HistoryBackfill } from '@investment/application/service/HistoryBackfill';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';
import { classOfTickerKind } from '@investment/domain/service/TickerClass';
import {
  B3TickerKind,
  IBrapiQuotes,
  IFinnhubQuotes,
  QuoteResult,
} from '@shared/infra/quotes/types';

export const TICKER_CLASS_MISMATCH_CODE = 'TICKER_CLASS_MISMATCH';
export const TICKER_NOT_FOUND_CODE = 'TICKER_NOT_FOUND';
export const SOURCE_UNAVAILABLE_CODE = 'QUOTE_SOURCE_UNAVAILABLE';

const CLASS_LABELS: Partial<Record<InvestmentAssetClass, string>> = {
  [InvestmentAssetClass.BR_REIT]: 'FIIs',
  [InvestmentAssetClass.BR_STOCK]: 'Stocks',
};

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

  // Spec 111 rule 5-6: the source kind has the last word on the class of a B3 ticker; an unknown kind (Fiagro,
  // a ticker the list does not carry, a failing list call) leaves the owner's choice alone.
  private async assertClass(assetClass: string, ticker: string): Promise<void> {
    let kind: B3TickerKind = 'UNKNOWN';

    try {
      kind = (await this.brapi.getTickerKinds(ticker))[ticker] ?? 'UNKNOWN';
    } catch {
      kind = 'UNKNOWN';
    }

    const required = classOfTickerKind(kind);

    if (!required || required === assetClass) {
      return;
    }

    const noun = kind === 'REIT' ? 'FII' : 'stock';

    throw new UnprocessableEntityException({
      code: TICKER_CLASS_MISMATCH_CODE,
      details: { expectedClass: required },
      message: `"${ticker}" is a ${noun} on B3. Use the class ${CLASS_LABELS[required]}.`,
    });
  }

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

    if (market === QuoteMarket.B3) {
      await this.assertClass(assetClass, ticker);
    }

    await this.fetcher.save(market, found, new Date());
    this.backfill.queue(market, ticker);
  }
}
