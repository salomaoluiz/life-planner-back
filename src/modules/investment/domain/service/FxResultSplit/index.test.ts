import { InvestmentOperationType } from '@investment/domain/enum';

import { averageFxCost, FxOperation, splitFxResult } from './index';

function operation(overrides: Partial<FxOperation>): FxOperation {
  return {
    createdAt: new Date('2026-01-01T00:00:00Z'),
    date: '2025-11-04',
    fxRate: '5.2236',
    id: 'op-1',
    total: 364200,
    type: InvestmentOperationType.BUY,
    ...overrides,
  };
}

describe('splitFxResult', () => {
  it('SHOULD split the artifact example into +R$ 5,150.47 (asset) + R$ 1,557.32 (dollar)', () => {
    const result = splitFxResult({
      averageFxRate: '5.2236',
      costUsd: 364200,
      currentFxRate: '5.5601',
      marketValueUsd: 462800,
    });

    expect(result).toEqual({
      costBrl: 1902435,
      marketValueBrl: 2573214,
      resultBrl: 670779,
      resultBrlFromAsset: 515047,
      resultBrlFromFx: 155732,
      resultBrlPercent: 0.3526,
    });
    expect(result.resultBrlFromAsset + result.resultBrlFromFx).toBe(result.resultBrl);
  });

  it('SHOULD keep the sum exact AND handle a loss', () => {
    const result = splitFxResult({
      averageFxRate: '5.5',
      costUsd: 100000,
      currentFxRate: '5.1',
      marketValueUsd: 90000,
    });

    expect(result.resultBrlFromAsset).toBe(-55000);
    expect(result.resultBrlFromAsset + result.resultBrlFromFx).toBe(result.resultBrl);
    expect(result.resultBrl).toBeLessThan(0);
  });

  it('SHOULD return a null percent WHEN the cost is zero', () => {
    expect(
      splitFxResult({ averageFxRate: '5', costUsd: 0, currentFxRate: '5', marketValueUsd: 0 })
        .resultBrlPercent,
    ).toBeNull();
  });
});

describe('averageFxCost', () => {
  it('SHOULD weight the rate by the USD cost of the lots', () => {
    const result = averageFxCost(
      [
        operation({ fxRate: '5', id: 'a', total: 100000 }),
        operation({ date: '2025-12-01', fxRate: '6', id: 'b', total: 300000 }),
      ],
      new Map(),
    );

    expect(result).toEqual({ averageFxRate: '5.75', operationsWithoutFxRate: 0 });
  });

  it('SHOULD keep the average after a partial sell (same proportion removed)', () => {
    const result = averageFxCost(
      [
        operation({ fxRate: '5', id: 'a', total: 100000 }),
        operation({ date: '2025-12-01', fxRate: '6', id: 'b', total: 100000 }),
        operation({
          date: '2026-01-01',
          id: 's',
          total: 90000,
          type: InvestmentOperationType.SELL,
        }),
      ],
      new Map([['s', 100000]]),
    );

    expect(result.averageFxRate).toBe('5.5');
  });

  it('SHOULD count BUY operations without a rate AND exclude them from the average', () => {
    const result = averageFxCost(
      [operation({ fxRate: null, id: 'a' }), operation({ fxRate: '5.5', id: 'b', total: 1000 })],
      new Map(),
    );

    expect(result).toEqual({ averageFxRate: '5.5', operationsWithoutFxRate: 1 });
  });

  it('SHOULD return a null average WHEN no lot has a rate', () => {
    expect(averageFxCost([operation({ fxRate: null })], new Map()).averageFxRate).toBeNull();
    expect(averageFxCost([], new Map())).toEqual({
      averageFxRate: null,
      operationsWithoutFxRate: 0,
    });
  });

  it('SHOULD order by date, creation AND id', () => {
    const result = averageFxCost(
      [
        operation({
          createdAt: new Date('2026-01-02T00:00:00Z'),
          fxRate: '6',
          id: 'z',
          total: 100000,
        }),
        operation({
          createdAt: new Date('2026-01-01T00:00:00Z'),
          fxRate: '5',
          id: 'y',
          total: 100000,
        }),
        operation({
          createdAt: new Date('2026-01-01T00:00:00Z'),
          fxRate: '4',
          id: 'x',
          total: 100000,
        }),
      ],
      new Map(),
    );

    expect(result.averageFxRate).toBe('5');
  });
});
