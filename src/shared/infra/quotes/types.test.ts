import {
  normalizeTicker,
  QuoteSourceLimitError,
  QuoteSourceUnavailableError,
  toSourceError,
} from './types';

describe('normalizeTicker', () => {
  it('SHOULD trim AND upper-case a valid ticker', () => {
    expect(normalizeTicker(' brk-b ')).toBe('BRK-B');
  });

  it.each(['', 'A B', 'ITSA4/../x', 'TOOLONGTICKER12'])('SHOULD refuse %p', (value) => {
    expect(() => normalizeTicker(value)).toThrow('Invalid ticker');
  });
});

describe('toSourceError', () => {
  it.each([429, 402, 503])('SHOULD classify status %p as a limit error', (status) => {
    expect(toSourceError({ response: { status } })).toBeInstanceOf(QuoteSourceLimitError);
  });

  it('SHOULD classify a timeout AND a missing response as a limit error', () => {
    expect(toSourceError({ code: 'ECONNABORTED' })).toBeInstanceOf(QuoteSourceLimitError);
    expect(toSourceError(new Error('socket'))).toBeInstanceOf(QuoteSourceLimitError);
  });

  it('SHOULD keep a 4xx error as it is', () => {
    const error = new Error('bad');
    Object.assign(error, { response: { status: 400 } });

    expect(toSourceError(error)).toBe(error);
    expect(toSourceError({ response: { status: 400 } })).toBeInstanceOf(Error);
  });

  it('SHOULD name the source WHEN it is not configured', () => {
    expect(new QuoteSourceUnavailableError('brapi').message).toContain('brapi');
  });
});
