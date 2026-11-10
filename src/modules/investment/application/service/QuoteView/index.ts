import { QuoteEntity } from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { lastBusinessDay } from '@investment/domain/service/MarketDate';
import { isStale } from '@investment/domain/service/QuoteResolver';

// The quote as the API shows it (spec 104 section 7).
export interface QuoteView {
  changePercent: null | string;
  dayHigh: null | string;
  dayLow: null | string;
  market: QuoteMarket;
  previousClose: null | string;
  price: string;
  quotedAt: Date;
  source: string;
  stale: boolean;
  ticker: string;
  unavailable: boolean;
}

export function toQuoteView(quote: QuoteEntity, now: Date, failed = false): QuoteView {
  return {
    changePercent: quote.changePercent,
    dayHigh: quote.dayHigh?.toString() ?? null,
    dayLow: quote.dayLow?.toString() ?? null,
    market: quote.market,
    previousClose: quote.previousClose?.toString() ?? null,
    price: quote.price.toString(),
    quotedAt: quote.quotedAt,
    source: quote.source,
    stale: failed || isStale(quote, lastBusinessDay(quote.market, now)),
    ticker: quote.ticker,
    unavailable: quote.unavailable,
  };
}
