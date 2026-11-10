import { buildPriceSeries } from './index';

function close(date: string, price = '10') {
  return { date, price };
}

describe('buildPriceSeries', () => {
  it('SHOULD add operation and valuation points only before the first stored close', () => {
    const result = buildPriceSeries({
      closes: [close('2026-11-04', '231.40'), close('2026-11-05', '232')],
      now: '2026-11-06',
      operations: [
        { date: '2025-11-10', price: '182.10' },
        { date: '2026-11-04', price: '230' },
      ],
      range: '1Y',
      valuations: [{ date: '2026-02-01', price: '200' }],
    });

    expect(result.historyStartsAt).toBe('2026-11-04');
    expect(result.points.map((point) => [point.date, point.kind])).toEqual([
      ['2025-11-10', 'OPERATION'],
      ['2026-02-01', 'VALUATION'],
      ['2026-11-04', 'CLOSE'],
      ['2026-11-05', 'CLOSE'],
    ]);
  });

  it('SHOULD return only synthetic points AND a null start WHEN there is no history', () => {
    const result = buildPriceSeries({
      closes: [],
      now: '2026-11-06',
      operations: [{ date: '2026-10-01', price: '5' }],
      range: '6M',
      valuations: [],
    });

    expect(result.historyStartsAt).toBeNull();
    expect(result.points).toEqual([{ date: '2026-10-01', kind: 'OPERATION', price: '5' }]);
  });

  it('SHOULD cut each range from its start date', () => {
    const closes = [close('2026-09-01'), close('2026-10-20'), close('2026-11-05')];
    const base = { closes, now: '2026-11-06', operations: [], valuations: [] };

    expect(buildPriceSeries({ ...base, range: '1M' }).points).toHaveLength(2);
    expect(buildPriceSeries({ ...base, range: '6M' }).points).toHaveLength(3);
    expect(buildPriceSeries({ ...base, range: 'ALL' }).points).toHaveLength(3);
  });

  it('SHOULD downsample to the last close of each week WHEN there are more than 400 points', () => {
    const closes = Array.from({ length: 450 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
      return close(date, String(index));
    });

    const result = buildPriceSeries({
      closes,
      now: '2026-03-31',
      operations: [],
      range: 'ALL',
      valuations: [],
    });

    expect(result.points.length).toBeLessThan(80);
    expect(result.points.every((point) => point.kind === 'CLOSE')).toBe(true);
  });

  it('SHOULD ignore closes after today', () => {
    const result = buildPriceSeries({
      closes: [close('2026-11-07')],
      now: '2026-11-06',
      operations: [],
      range: '1M',
      valuations: [],
    });

    expect(result.points).toEqual([]);
  });
});
