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
import { classOfTickerKind } from '@investment/domain/service/TickerKind';
import {
  B3TickerKind,
  IBrapiQuotes,
  IFinnhubQuotes,
  QuoteResult,
} from '@shared/infra/quotes/types';

export const TICKER_NOT_FOUND_CODE = 'TICKER_NOT_FOUND';
export const TICKER_CLASS_MISMATCH_CODE = 'TICKER_CLASS_MISMATCH';
export const SOURCE_UNAVAILABLE_CODE = 'QUOTE_SOURCE_UNAVAILABLE';

const CLASS_LABEL: Record<string, string> = {
  BR_REIT: 'REITs (FII)',
  BR_STOCK: 'Stocks / ETFs (B3)',
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
      await this.ensureClassMatches(assetClass, ticker);
    }

    await this.fetcher.save(market, found, new Date());
    this.backfill.queue(market, ticker);
  }

  // Spec 111 rule 5: a B3 ticker of a known kind only saves under the class that kind requires; Fiagro, unknown
  // kinds and a failed kind list (fail open) have no rule.
  private async ensureClassMatches(assetClass: string, ticker: string): Promise<void> {
    let kinds: Record<string, B3TickerKind> | undefined;

    try {
      kinds = await this.brapi.getKinds(ticker);
    } catch {
      return;
    }

    const expectedClass = classOfTickerKind(kinds?.[ticker] ?? 'UNKNOWN');

    if (expectedClass && expectedClass !== assetClass) {
      throw new UnprocessableEntityException({
        code: TICKER_CLASS_MISMATCH_CODE,
        details: { expectedClass },
        message: `"${ticker}" is a ${expectedClass === 'BR_REIT' ? 'FII' : 'stock'} on B3. Use the class ${CLASS_LABEL[expectedClass]}.`,
      });
    }
  }
}
