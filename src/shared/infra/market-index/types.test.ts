import { MarketIndexSourceError, toMarketIndexError } from './types';

describe('toMarketIndexError', () => {
  it('SHOULD keep the HTTP status in the code', () => {
    expect(toMarketIndexError({ response: { status: 503 } })).toEqual(
      new MarketIndexSourceError('HTTP_503'),
    );
  });

  it('SHOULD map aborted and timed out calls to TIMEOUT', () => {
    expect(toMarketIndexError({ code: 'ECONNABORTED' }).code).toBe('TIMEOUT');
    expect(toMarketIndexError({ code: 'ETIMEDOUT' }).code).toBe('TIMEOUT');
  });

  it('SHOULD map anything else to NETWORK', () => {
    expect(toMarketIndexError(new Error('boom')).code).toBe('NETWORK');
  });
});
