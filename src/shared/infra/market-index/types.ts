// Central Bank market indexes (spec 113). Values stay decimal strings as the source sends them.
export interface IBcbIndexes {
  // The Focus median of the IPCA expectation for the next 12 months, from `from` (YYYY-MM-DD) to today.
  getIpcaExpectation(from: string): Promise<IndexPoint[]>;
  // One SGS series between two dates (YYYY-MM-DD); ranges over the source window are split.
  getSeries(code: number, from: string, to: string): Promise<IndexPoint[]>;
}
export interface IndexPoint {
  date: string;
  value: string;
}

// A failed call, with the short code stored in `market_index_fetches.last_error` (`HTTP_503`, `TIMEOUT`, ...).
export class MarketIndexSourceError extends Error {
  constructor(readonly code: string) {
    super(`Market index source failed: ${code}`);
  }
}

// Maps an axios-like failure to `MarketIndexSourceError`.
export function toMarketIndexError(error: unknown): MarketIndexSourceError {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const code = (error as { code?: string })?.code;

  if (status !== undefined) {
    return new MarketIndexSourceError(`HTTP_${status}`);
  }
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return new MarketIndexSourceError('TIMEOUT');
  }

  return new MarketIndexSourceError('NETWORK');
}
