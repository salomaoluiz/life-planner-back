import { brapiRangeFor, largestAllowedRange, selectRows, withRetry } from './plan';

describe('brapiRangeFor', () => {
  it.each([
    ['2026-10-20', '1mo'],
    ['2026-09-01', '3mo'],
    ['2026-06-01', '6mo'],
    ['2026-01-01', '1y'],
    ['2025-03-01', '2y'],
    ['2023-01-01', '5y'],
    ['2018-01-01', '10y'],
    ['2000-01-01', 'max'],
  ])('SHOULD pick the shortest range reaching %s', (from, range) => {
    expect(brapiRangeFor(from, '2026-11-10')).toBe(range);
  });
});

describe('largestAllowedRange', () => {
  it('SHOULD pick the longest allowed range we know', () => {
    expect(
      largestAllowedRange(
        'O range "6mo" não está disponível. Ranges permitidos: 1d, 5d, 1mo, 3mo. Faça upgrade',
      ),
    ).toBe('3mo');
  });

  it('SHOULD return null WHEN the message lists none', () => {
    expect(largestAllowedRange('erro')).toBeNull();
    expect(largestAllowedRange('Ranges permitidos: 1d, 5d.')).toBeNull();
  });
});

describe('selectRows', () => {
  it('SHOULD keep the days inside [from, to]', () => {
    const rows = [
      { close: '1', date: '2026-01-01' },
      { close: '2', date: '2026-02-01' },
      { close: '3', date: '2026-03-01' },
    ];

    expect(selectRows(rows, '2026-02-01', '2026-02-28')).toEqual([rows[1]]);
  });
});

describe('withRetry', () => {
  const sleep = jest.fn().mockResolvedValue(undefined);
  const options = { attempts: 3, baseMs: 100, isRetryable: () => true, sleep };

  beforeEach(() => sleep.mockClear());

  it('SHOULD retry with exponential backoff until it works', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('429'))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValue('ok');

    expect(await withRetry(fn, options)).toBe('ok');
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it('SHOULD give up after the attempts AND not retry what is not retryable', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('429'));

    await expect(withRetry(failing, options)).rejects.toThrow('429');
    expect(failing).toHaveBeenCalledTimes(3);

    const fatal = jest.fn().mockRejectedValue(new Error('400'));
    await expect(withRetry(fatal, { ...options, isRetryable: () => false })).rejects.toThrow('400');
    expect(fatal).toHaveBeenCalledTimes(1);
  });
});
