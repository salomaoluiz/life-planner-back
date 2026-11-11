import { InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import {
  calculatePosition,
  computeTotals,
  FeesHigherThanSaleError,
  PositionOperation,
} from './index';

const BUY = InvestmentOperationType.BUY;
const SELL = InvestmentOperationType.SELL;

function operation(
  id: string,
  type: InvestmentOperationType,
  date: string,
  quantity: string,
  total: number,
  createdAt = new Date('2026-01-01T00:00:00Z'),
): PositionOperation {
  return { createdAt, date, id, quantity: Decimal8.parse(quantity), total, type };
}

const buys = [
  operation('a', BUY, '2026-01-10', '500', 440000),
  operation('b', BUY, '2026-03-10', '500', 522650),
  operation('c', BUY, '2026-06-10', '500', 510650),
];

describe('calculatePosition', () => {
  it('SHOULD fold fees into cost and average price', () => {
    const position = calculatePosition(buys);

    expect(position.quantity.toString()).toBe('1500');
    expect(position.cost).toBe(1473300);
    expect(position.averagePrice).toBe('9.82200000');
    expect(position.negativeAt).toBeNull();
  });

  it('SHOULD realize the proportional cost on a sell AND keep the average', () => {
    const position = calculatePosition([
      ...buys,
      operation('d', SELL, '2026-09-15', '300', 326450),
    ]);

    expect(position.perOperation.get('d')).toEqual({ costRemoved: 294660, realizedResult: 31790 });
    expect(position.realizedResult).toBe(31790);
    expect(position.quantity.toString()).toBe('1200');
    expect(position.averagePrice).toBe('9.82200000');
  });

  it('SHOULD flag the first operation that makes the position negative', () => {
    const position = calculatePosition([...buys, operation('d', SELL, '2026-09-15', '1600', 1)]);

    expect(position.negativeAt).toEqual({ date: '2026-09-15', operationId: 'd' });
  });

  it('SHOULD flag a sell dated before the buy it depends on', () => {
    const position = calculatePosition([
      operation('a', BUY, '2026-05-01', '10', 1000),
      operation('s', SELL, '2026-04-01', '5', 500),
    ]);

    expect(position.negativeAt).toEqual({ date: '2026-04-01', operationId: 's' });
  });

  it('SHOULD reset cost at zero quantity AND start a new average', () => {
    const position = calculatePosition([
      operation('a', BUY, '2026-01-01', '10', 1000),
      operation('s', SELL, '2026-02-01', '10', 1500),
      operation('b', BUY, '2026-03-01', '5', 1000),
    ]);

    expect(position.perOperation.get('s')).toEqual({ costRemoved: 1000, realizedResult: 500 });
    expect(position.cost).toBe(1000);
    expect(position.averagePrice).toBe('2.00000000');
  });

  it('SHOULD order same day operations by creation then id', () => {
    const position = calculatePosition([
      operation('s', SELL, '2026-01-01', '5', 500, new Date('2026-01-01T10:00:00Z')),
      operation('a', BUY, '2026-01-01', '10', 1000, new Date('2026-01-01T09:00:00Z')),
    ]);

    expect(position.negativeAt).toBeNull();
    expect(position.quantity.toString()).toBe('5');
  });

  it('SHOULD keep 8 decimal quantities exact AND return a null average at zero', () => {
    const position = calculatePosition([operation('a', BUY, '2026-01-01', '18.3572', 18357)]);

    expect(position.quantity.toFixed8()).toBe('18.35720000');
    expect(calculatePosition([]).averagePrice).toBeNull();
  });

  it('SHOULD round the removed cost half up', () => {
    const position = calculatePosition([
      operation('a', BUY, '2026-01-01', '3', 100),
      operation('s', SELL, '2026-02-01', '1', 40),
    ]);

    // 100 / 3 = 33.33 -> 33
    expect(position.perOperation.get('s')?.costRemoved).toBe(33);
  });
});

describe('computeTotals', () => {
  it('SHOULD add fees to a buy AND subtract them from a sell', () => {
    const quantity = Decimal8.parse('300');
    const price = Decimal8.parse('10.90');

    expect(computeTotals(BUY, quantity, price, [490, 60])).toEqual({
      feesTotal: 550,
      gross: 327000,
      total: 327550,
    });
    expect(computeTotals(SELL, quantity, price, [490, 60]).total).toBe(326450);
  });

  it('SHOULD refuse a sell whose fees exceed the sale', () => {
    expect(() => computeTotals(SELL, Decimal8.parse('1'), Decimal8.parse('1'), [101])).toThrow(
      FeesHigherThanSaleError,
    );
  });
});

describe('calculatePosition with corporate events (spec 108)', () => {
  const WHOLE = { step: 'WHOLE' } as const;

  function split(id: string, date: string, from: string, to: string, createdAt?: Date) {
    const type = Number(to) > Number(from) ? 'SPLIT' : 'REVERSE_SPLIT';

    return {
      ...operation(id, type as InvestmentOperationType, date, '0', 0, createdAt),
      event: {
        kind: 'SPLIT' as const,
        ratioFrom: Decimal8.parse(from),
        ratioTo: Decimal8.parse(to),
      },
    };
  }
  function bonus(id: string, date: string, percent: string, unitCost: null | string) {
    return {
      ...operation(id, InvestmentOperationType.BONUS, date, '0', 0),
      event: {
        kind: 'BONUS' as const,
        percent: Decimal8.parse(percent),
        unitCost: unitCost ? Decimal8.parse(unitCost) : null,
      },
    };
  }
  const mglu = [operation('a', BUY, '2026-01-10', '3155', 319100)];

  it('SHOULD reverse split, leave a pending fraction and recompute the average', () => {
    const position = calculatePosition([...mglu, split('e', '2026-03-10', '10', '1')], WHOLE);

    expect(position.quantity.toString()).toBe('315');
    expect(position.cost).toBe(318594);
    expect(position.averagePrice).toBe('10.11409524');
    expect(position.pendingFractions).toEqual([
      { cost: 506, date: '2026-03-10', eventId: 'e', quantity: Decimal8.parse('0.5') },
    ]);
    expect(position.perEvent.get('e')?.quantityBefore.toString()).toBe('3155');
  });

  it('SHOULD add the bonus cost when the unit cost is informed', () => {
    const position = calculatePosition(
      [operation('a', BUY, '2026-01-10', '315', 318594), bonus('e', '2026-11-18', '10', '4.5')],
      WHOLE,
    );

    expect(position.quantity.toString()).toBe('346');
    expect(position.cost).toBe(332544);
  });

  it('SHOULD give a BUY on the data-com the event even when it was created after it', () => {
    const early = new Date('2026-01-01T00:00:00Z');
    const late = new Date('2026-06-01T00:00:00Z');
    const position = calculatePosition(
      [
        operation('a', BUY, '2026-01-10', '100', 10000, early),
        split('e', '2026-03-10', '1', '2', early),
        operation('b', BUY, '2026-03-10', '50', 5000, late),
      ],
      WHOLE,
    );

    expect(position.quantity.toString()).toBe('300');
  });

  it('SHOULD flag an event dated where no shares are held', () => {
    const position = calculatePosition([split('e', '2026-03-10', '1', '2')], WHOLE);

    expect(position.noPositionAt).toEqual({ date: '2026-03-10', operationId: 'e' });
  });

  it('SHOULD zero the cost when the whole position becomes a fraction', () => {
    const position = calculatePosition(
      [operation('a', BUY, '2026-01-10', '50', 10000), split('e', '2026-03-10', '100', '1')],
      WHOLE,
    );

    expect(position.quantity.isZero()).toBe(true);
    expect(position.cost).toBe(0);
    expect(position.averagePrice).toBeNull();
    expect(position.pendingFractions[0].cost).toBe(10000);
  });

  it('SHOULD realize the fraction sale without touching quantity or cost', () => {
    const position = calculatePosition(
      [
        ...mglu,
        split('e', '2026-03-10', '10', '1'),
        {
          ...operation('f', SELL, '2026-04-04', '0.5', 520),
          fractionOfOperationId: 'e',
        },
      ],
      WHOLE,
    );

    expect(position.quantity.toString()).toBe('315');
    expect(position.cost).toBe(318594);
    expect(position.perOperation.get('f')).toEqual({ costRemoved: 506, realizedResult: 14 });
    expect(position.realizedResult).toBe(14);
    expect(position.pendingFractions).toEqual([]);
  });

  it('SHOULD apply a fraction sale dated on the event day after the event', () => {
    const position = calculatePosition(
      [
        ...mglu,
        {
          ...operation('f', SELL, '2026-03-10', '0.5', 520),
          fractionOfOperationId: 'e',
        },
        split('e', '2026-03-10', '10', '1'),
      ],
      WHOLE,
    );

    expect(position.perOperation.get('f')?.costRemoved).toBe(506);
  });

  it('SHOULD refuse a later sell of the old quantity', () => {
    const position = calculatePosition(
      [...mglu, split('e', '2026-03-10', '10', '1'), operation('s', SELL, '2026-04-01', '3000', 1)],
      WHOLE,
    );

    expect(position.negativeAt).toEqual({ date: '2026-04-01', operationId: 's' });
  });

  it('SHOULD keep decimals for classes with a decimal step', () => {
    const position = calculatePosition(
      [operation('a', BUY, '2026-01-10', '12.5', 230500), split('e', '2026-08-25', '1', '4')],
      { step: 'DECIMAL' },
    );

    expect(position.quantity.toString()).toBe('50');
    expect(position.averagePrice).toBe('46.10000000');
    expect(position.pendingFractions).toEqual([]);
  });
});
