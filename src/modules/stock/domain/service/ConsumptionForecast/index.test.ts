import { StockUnits } from '@stock/domain/entity/StockEntity';
import {
  computeForecast,
  ConsumptionDay,
  forecastQuantity,
  leftoverFor,
  pickLeftover,
  projectedOnTrip,
  wasteRatio,
} from '@stock/domain/service/ConsumptionForecast';

const today = new Date('2026-11-25T00:00:00.000Z');

function day(ageDays: number, consumed: number, startQuantity = 10): ConsumptionDay {
  return { ageDays, consumed, startQuantity };
}
// One consumption per day for `count` days, 1 unit each.
function steady(count: number, consumed = 1): ConsumptionDay[] {
  return Array.from({ length: count }, (_, index) => day(index + 1, consumed));
}
const base = { consumeCount: 30, minQuantity: 2, quantity: 10, spanDays: 29, today };

describe('computeForecast', () => {
  it('weights recent days and projects the dates for a steady consumer', () => {
    const result = computeForecast({ ...base, days: steady(30), unit: StockUnits.UNIT });

    expect(result.status).toBe('OK');
    expect(result.dailyRate).toBe(1);
    expect(result.minDate).toEqual(new Date('2026-12-03T00:00:00.000Z'));
    expect(result.emptyDate).toEqual(new Date('2026-12-05T00:00:00.000Z'));
  });

  it('ignores days when the item was at zero', () => {
    const days = [...steady(30), ...Array.from({ length: 7 }, (_, index) => day(40 + index, 0, 0))];

    expect(computeForecast({ ...base, days, unit: StockUnits.UNIT }).dailyRate).toBe(1);
  });

  it('leans toward the recent weeks after a habit change', () => {
    const days = [
      ...Array.from({ length: 14 }, (_, index) => day(index + 1, 3)),
      ...Array.from({ length: 28 }, (_, index) => day(index + 15, 1)),
    ];
    const result = computeForecast({ ...base, days, unit: StockUnits.UNIT });
    const plain = (14 * 3 + 28) / 42;

    expect(result.dailyRate).toBeGreaterThan(plain);
  });

  it('needs two consumes at least 14 days apart and 14 counted days', () => {
    const apart = computeForecast({
      ...base,
      days: steady(30),
      spanDays: 10,
      unit: StockUnits.UNIT,
    });
    const few = computeForecast({ ...base, days: steady(10), unit: StockUnits.UNIT });
    const single = computeForecast({
      ...base,
      consumeCount: 1,
      days: steady(30),
      unit: StockUnits.UNIT,
    });

    expect([apart.status, few.status, single.status]).toEqual(Array(3).fill('INSUFFICIENT_DATA'));
    expect(apart.minDate).toBeUndefined();
  });

  it('reports NO_CONSUMPTION when the rate is zero', () => {
    const result = computeForecast({ ...base, days: steady(30, 0), unit: StockUnits.UNIT });

    expect(result.status).toBe('NO_CONSUMPTION');
    expect(result.emptyDate).toBeUndefined();
  });

  it('keeps three decimals for kg and liters', () => {
    const result = computeForecast({
      ...base,
      days: steady(30, 0.3333),
      unit: StockUnits.KILOGRAM,
    });

    expect(result.dailyRate).toBe(0.333);
  });

  it('puts an item at zero or below its minimum on today', () => {
    const result = computeForecast({
      ...base,
      days: steady(30),
      quantity: 0,
      unit: StockUnits.UNIT,
    });

    expect(result.minDate).toEqual(today);
    expect(result.emptyDate).toEqual(today);
  });
});

describe('forecastQuantity', () => {
  it('refills the ideal on the trip day, rounding units up', () => {
    // projected = 6 - 0.8 * 4 = 2.8 -> ideal 8 - 2.8 = 5.2 -> 6
    expect(
      forecastQuantity({
        daysToTrip: 4,
        idealQuantity: 8,
        intervalDays: 7,
        quantity: 6,
        rate: 0.8,
        unit: StockUnits.UNIT,
      }),
    ).toBe(6);
  });

  it('keeps three decimals for kg', () => {
    expect(
      forecastQuantity({
        daysToTrip: 4,
        idealQuantity: 8,
        intervalDays: 7,
        quantity: 6,
        rate: 0.8,
        unit: StockUnits.KILOGRAM,
      }),
    ).toBe(5.2);
  });

  it('covers the interval when there is no ideal', () => {
    expect(
      forecastQuantity({
        daysToTrip: 4,
        intervalDays: 7,
        quantity: 6,
        rate: 0.5,
        unit: StockUnits.UNIT,
      }),
    ).toBe(4);
  });

  it('returns 0 when nothing is needed', () => {
    expect(
      forecastQuantity({
        daysToTrip: 1,
        idealQuantity: 3,
        intervalDays: 7,
        quantity: 9,
        rate: 0.5,
        unit: StockUnits.UNIT,
      }),
    ).toBe(0);
  });
});

describe('projectedOnTrip', () => {
  it('floors at zero', () => {
    expect(projectedOnTrip(2, 1, 5)).toBe(0);
    expect(projectedOnTrip(6, 0.5, 4)).toBe(4);
  });
});

function lot(id: string, quantity: number, days?: number, openedAt?: Date) {
  return {
    effectiveExpiration:
      days === undefined ? undefined : new Date(today.getTime() + days * 86_400_000),
    id,
    openedAt,
    quantity,
  };
}

describe('leftoverFor', () => {
  it('warns of a lot that will still have units on its expiration day', () => {
    // 3 units, rate 0.5/day, expires in 4 days: 2 consumed, 1 left
    expect(
      leftoverFor({ lots: [lot('a', 3, 4)], rate: 0.5, today, unit: StockUnits.UNIT }),
    ).toEqual([{ date: new Date(today.getTime() + 4 * 86_400_000), lotId: 'a', quantity: 1 }]);
  });

  it('ignores kg leftovers below 50 g and lots without expiration', () => {
    expect(
      leftoverFor({ lots: [lot('a', 1.04, 2)], rate: 0.5, today, unit: StockUnits.KILOGRAM }),
    ).toEqual([]);
    expect(leftoverFor({ lots: [lot('b', 5)], rate: 0.5, today, unit: StockUnits.UNIT })).toEqual(
      [],
    );
  });

  it('consumes the open lot before the closed one', () => {
    const open = lot('open', 2, 10, new Date(today));
    const closed = lot('closed', 4, 5);
    const result = leftoverFor({ lots: [closed, open], rate: 1, today, unit: StockUnits.UNIT });

    // open takes days 0-2, closed has 3 days -> 3 consumed, 1 left
    expect(result.map((entry) => [entry.lotId, entry.quantity])).toEqual([['closed', 1]]);
  });

  it('returns nothing without a rate', () => {
    expect(leftoverFor({ lots: [lot('a', 3, 4)], rate: 0, today, unit: StockUnits.UNIT })).toEqual(
      [],
    );
  });
});

function entry(lotId: string, quantity: number) {
  return { date: today, lotId, quantity };
}

describe('pickLeftover', () => {
  it('picks the largest leftover', () => {
    expect(pickLeftover([entry('a', 1), entry('b', 3)], new Map())?.lotId).toBe('b');
  });

  it('hides a dismissed lot until the leftover grows by one unit', () => {
    const dismissed = new Map([['b', 3]]);

    expect(pickLeftover([entry('a', 1), entry('b', 3)], dismissed, StockUnits.UNIT)?.lotId).toBe(
      'a',
    );
    expect(pickLeftover([entry('b', 4)], dismissed, StockUnits.UNIT)?.lotId).toBe('b');
  });

  it('uses 50 g for kg growth', () => {
    const dismissed = new Map([['b', 1]]);

    expect(pickLeftover([entry('b', 1.04)], dismissed, StockUnits.KILOGRAM)).toBeNull();
    expect(pickLeftover([entry('b', 1.05)], dismissed, StockUnits.KILOGRAM)?.lotId).toBe('b');
  });
});

describe('wasteRatio', () => {
  it('is null when nothing entered', () => {
    expect(wasteRatio(2, 0)).toBeNull();
    expect(wasteRatio(2, 5)).toBe(0.4);
  });
});
