import { FxRate, FxRateHistory, InvestmentPriceHistory, InvestmentQuote } from '@db/client';

export type IQuoteDatasource = {
  findFx(pair: string): Promise<FxRate | null>;
  findFxHistory(pair: string, from: Date, to: Date): Promise<FxRateHistory[]>;
  findFxOnOrBefore(pair: string, date: Date): Promise<FxRateHistory | null>;
  findHistory(
    market: string,
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<InvestmentPriceHistory[]>;
  findQuotes(keys: QuoteDatasourceKey[]): Promise<InvestmentQuote[]>;
  findTrackedSymbols(since: Date): Promise<QuoteDatasourceKey[]>;
  hasHistory(market: string, ticker: string): Promise<boolean>;
  markMissing(keys: QuoteDatasourceKey[]): Promise<void>;
  markQuoteErrors(keys: QuoteDatasourceKey[], at: Date): Promise<void>;
  runExclusive(key: number, fn: () => Promise<void>): Promise<boolean>;
  saveFx(row: { pair: string; quoted_at: Date; rate: string; source: string }): Promise<void>;
  saveFxHistory(rows: { date: Date; pair: string; rate: string; source: string }[]): Promise<void>;
  saveHistory(
    rows: { close: string; date: Date; market: string; source: string; ticker: string }[],
  ): Promise<void>;
  saveQuotes(rows: QuoteDatasourceUpsert[], fetchedAt: Date): Promise<void>;
};
export interface QuoteDatasourceKey {
  market: string;
  ticker: string;
}
export interface QuoteDatasourceUpsert {
  change_percent: null | string;
  currency: string;
  day_high: null | string;
  day_low: null | string;
  logo_url: null | string;
  market: string;
  name: null | string;
  previous_close: null | string;
  price: string;
  quoted_at: Date;
  source: string;
  ticker: string;
}
