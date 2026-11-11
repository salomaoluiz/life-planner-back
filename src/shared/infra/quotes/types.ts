// Market data sources (spec 104). Prices are decimal strings so nothing passes through floats.
export type CorporateEventKind = 'BONUS' | 'REVERSE_SPLIT' | 'SPLIT';
export interface DailyClose {
  close: string;
  date: string;
}
export interface FxQuote {
  quotedAt: Date;
  rate: string;
  source: 'AWESOMEAPI' | 'BRAPI';
}
// Spec 108: an announced split, reverse split or bonus; ratios and percent are decimal strings, `recordDate` is
// the data-com (`YYYY-MM-DD`).
export interface CorporateEventResult {
  bonusPercent?: string;
  bonusUnitCost?: string;
  currency: string;
  ratioFrom?: string;
  ratioTo?: string;
  recordDate: string;
  ticker: string;
  type: CorporateEventKind;
}
export type IncomeEventType = 'DIVIDEND' | 'INTEREST' | 'JCP' | 'OTHER' | 'YIELD';
// Spec 107: an announced income; `amountPerUnit` is gross, a decimal string; dates are `YYYY-MM-DD`.
export interface IBrapiQuotes {
  // Announced splits, reverse splits and bonus shares of one B3 symbol (spec 108).
  getCorporateEvents(symbol: string): Promise<CorporateEventResult[]>;
  // Daily closes of one B3 symbol; `range` is a brapi range such as `3mo`.
  getDailyHistory(symbol: string, range: string): Promise<DailyClose[]>;
  // Announced dividends, JCP and yields of one B3 symbol (spec 107).
  getIncomeEvents(symbol: string): Promise<IncomeEventResult[]>;
  getQuotes(symbols: string[]): Promise<QuoteResult[]>;
  search(query: string): Promise<QuoteResult[]>;
}
export interface IFinnhubQuotes {
  // Announced splits of one US symbol; `[]` when the plan has no splits endpoint (spec 108).
  getCorporateEvents(symbol: string): Promise<CorporateEventResult[]>;
  // Announced dividends of one US symbol; `[]` when the plan has no dividends endpoint (spec 107).
  getIncomeEvents(symbol: string): Promise<IncomeEventResult[]>;
  getQuotes(symbols: string[]): Promise<QuoteResult[]>;
  search(query: string): Promise<QuoteResult[]>;
}
export interface IFxRates {
  getUsdBrl(): Promise<FxQuote>;
}
export interface IncomeEventResult {
  amountPerUnit: string;
  currency: string;
  exDate: string;
  paymentDate: null | string;
  ticker: string;
  type: IncomeEventType;
}
export interface QuoteResult {
  changePercent: null | string;
  dayHigh: null | string;
  dayLow: null | string;
  logoUrl: null | string;
  name: null | string;
  previousClose: null | string;
  price: string;
  quotedAt: Date;
  ticker: string;
}

// A source that answers 429, a quota error, 5xx or times out: the job stops calling it for the run.
export class QuoteSourceLimitError extends Error {}
// A source without its token: its market behaves as "no quote".
export class QuoteSourceUnavailableError extends Error {
  constructor(source: string) {
    super(`Quote source ${source} is not configured`);
  }
}

const TICKER_PATTERN = /^[A-Z0-9.-]{1,12}$/;

// Tickers reach URLs: upper-cased and checked first (spec 104 section 11).
export function normalizeTicker(value: string): string {
  const ticker = value.trim().toUpperCase();

  if (!TICKER_PATTERN.test(ticker)) {
    throw new Error('Invalid ticker');
  }

  return ticker;
}

// Maps an axios-like failure to the error classes above.
export function toSourceError(error: unknown): Error {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const code = (error as { code?: string })?.code;

  if (status === 429 || status === 402 || (status !== undefined && status >= 500)) {
    return new QuoteSourceLimitError(`Quote source answered ${status}`);
  }
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || status === undefined) {
    return new QuoteSourceLimitError('Quote source timed out');
  }

  return error instanceof Error ? error : new Error('Quote source failed');
}
