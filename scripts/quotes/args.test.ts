import { parseArgs } from './args';

const today = '2026-11-10';

describe('parseArgs', () => {
  it('SHOULD default to yesterday, 500 ms, no dry run, no fx', () => {
    expect(parseArgs([], today)).toEqual({
      delayMs: 500,
      dryRun: false,
      fx: false,
      to: '2026-11-09',
    });
  });

  it('SHOULD read every option', () => {
    expect(
      parseArgs(
        [
          '--from',
          '2025-11-01',
          '--to',
          '2026-01-31',
          '--tickers',
          'itsa4, HGLG11',
          '--fx',
          '--dry-run',
          '--delay-ms',
          '0',
        ],
        today,
      ),
    ).toEqual({
      delayMs: 0,
      dryRun: true,
      from: '2025-11-01',
      fx: true,
      tickers: ['ITSA4', 'HGLG11'],
      to: '2026-01-31',
    });
  });

  it.each([
    [['--from', '2025/11/01'], '--from must be a date'],
    [['--from', '2026-02-31x'], '--from must be a date'],
    [['--from'], '--from needs a value'],
    [['--tickers', 'a/b'], 'valid tickers'],
    [['--tickers', ','], 'valid tickers'],
    [['--delay-ms', '-1'], 'non-negative'],
    [['--from', '2026-12-01'], 'must not be after'],
    [['--nope'], 'Unknown option'],
  ])('SHOULD refuse %p', (argv, message) => {
    expect(() => parseArgs(argv, today)).toThrow(message);
  });
});
