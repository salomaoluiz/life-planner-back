import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

// Market data (spec 104): global, shared by every owner.
export interface FxRateEntity {
  pair: string;
  quotedAt: Date;
  // BRL per 1 USD, a decimal string with up to 6 places.
  rate: string;
  source: string;
}
export interface PriceHistoryRow {
  close: Decimal8;
  date: string;
  market: QuoteMarket;
  source: QuoteSource;
  ticker: string;
}
export interface QuoteEntity {
  changePercent: null | string;
  currency: string;
  dayHigh: Decimal8 | null;
  dayLow: Decimal8 | null;
  fetchedAt: Date;
  lastErrorAt: Date | null;
  logoUrl: null | string;
  market: QuoteMarket;
  missingDays: number;
  name: null | string;
  previousClose: Decimal8 | null;
  price: Decimal8;
  quotedAt: Date;
  source: QuoteSource;
  ticker: string;
  unavailable: boolean;
}
export interface QuoteUpsert {
  changePercent: null | string;
  currency: string;
  dayHigh: null | string;
  dayLow: null | string;
  logoUrl: null | string;
  market: QuoteMarket;
  name: null | string;
  previousClose: null | string;
  price: string;
  quotedAt: Date;
  source: QuoteSource;
  ticker: string;
}
// A symbol the job fetches, with when it was last fetched (null = never).
export interface TrackedSymbol {
  fetchedAt: Date | null;
  market: QuoteMarket;
  ticker: string;
}
