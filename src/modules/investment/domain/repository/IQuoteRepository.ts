import {
  FxRateEntity,
  PriceHistoryRow,
  QuoteEntity,
  QuoteUpsert,
  TrackedSymbol,
} from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

export interface FxHistoryRow {
  date: string;
  pair: string;
  rate: string;
  source: string;
}
export type IQuoteRepository = {
  findFx(pair: string): Promise<FxRateEntity | undefined>;
  // The latest stored rate on or before `date` (a calendar day), or undefined.
  findFxHistory(pair: string, from: string, to: string): Promise<FxHistoryRow[]>;
  findFxOnOrBefore(pair: string, date: string): Promise<string | undefined>;
  findHistory(
    market: QuoteMarket,
    ticker: string,
    from: string,
    to: string,
  ): Promise<PriceHistoryRow[]>;
  findQuotes(keys: QuoteKey[]): Promise<QuoteEntity[]>;
  // Quoted, non-archived assets of any owner with quantity > 0, or an operation since `since`; with the last fetch.
  findTrackedSymbols(since: string): Promise<TrackedSymbol[]>;
  hasHistory(market: QuoteMarket, ticker: string): Promise<boolean>;
  // Consecutive business days without a quote: +1 and `unavailable` from 5 (cleared by `saveQuotes`).
  markMissing(keys: QuoteKey[]): Promise<void>;
  markQuoteErrors(keys: QuoteKey[], at: Date): Promise<void>;
  // Runs `fn` only when no other instance holds the advisory lock `key`; false when it was skipped.
  runExclusive(key: number, fn: () => Promise<void>): Promise<boolean>;
  saveFx(rate: FxRateEntity): Promise<void>;
  saveFxHistory(rows: FxHistoryRow[]): Promise<void>;
  saveHistory(rows: PriceHistoryRow[]): Promise<void>;
  // Upserts the latest quote per symbol and clears its error, missing days and `unavailable`.
  saveQuotes(rows: QuoteUpsert[], fetchedAt: Date): Promise<void>;
};
export interface QuoteKey {
  market: QuoteMarket;
  ticker: string;
}
