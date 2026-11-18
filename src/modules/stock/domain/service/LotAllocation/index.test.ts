import { defaultOpenLot, findEntryLot, planConsume, planOpen } from './index';

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

describe('planConsume', () => {
  const open = { id: 'open', openedAt: day('2026-11-01'), quantity: 1 };
  const early = { expirationDate: day('2026-11-20'), id: 'early', quantity: 2 };
  const late = { expirationDate: day('2026-12-20'), id: 'late', quantity: 2 };
  const noDate = { id: 'none', quantity: 2 };

  it('SHOULD consume open lots first, then closed ones by expiration with nulls last', () => {
    expect(planConsume([noDate, late, early, open], 4)).toEqual([
      { lotId: 'open', quantity: 1 },
      { lotId: 'early', quantity: 2 },
      { lotId: 'late', quantity: 1 },
    ]);
  });

  it('SHOULD empty every lot WHEN the quantity equals the total', () => {
    expect(planConsume([early, late], 4)).toEqual([
      { lotId: 'early', quantity: 2 },
      { lotId: 'late', quantity: 2 },
    ]);
  });

  it('SHOULD return undefined WHEN the lots do not hold the quantity', () => {
    expect(planConsume([early], 2.001)).toBeUndefined();
  });

  it('SHOULD ignore empty lots and sum decimals exactly', () => {
    const lots = [
      { id: 'a', quantity: 0.1 },
      { id: 'b', quantity: 0.2 },
      { id: 'z', quantity: 0 },
    ];

    expect(planConsume(lots, 0.3)).toEqual([
      { lotId: 'a', quantity: 0.1 },
      { lotId: 'b', quantity: 0.2 },
    ]);
  });

  it('SHOULD order open lots by effective expiration and break ties by id', () => {
    const a = { id: 'a', openedAt: day('2026-11-05'), quantity: 1 };
    const b = { id: 'b', openedAt: day('2026-11-01'), quantity: 1 };
    const c = { id: 'c', openedAt: day('2026-11-01'), quantity: 1 };

    expect(planConsume([a, c, b], 3, 5)?.map((step) => step.lotId)).toEqual(['b', 'c', 'a']);
    expect(planConsume([a, c, b], 3)?.map((step) => step.lotId)).toEqual(['a', 'b', 'c']);
  });
});

describe('findEntryLot', () => {
  const closed = { expirationDate: day('2026-11-20'), id: 'closed', quantity: 1 };
  const noDate = { id: 'none', quantity: 1 };
  const open = {
    expirationDate: day('2026-11-20'),
    id: 'open',
    openedAt: day('2026-11-01'),
    quantity: 1,
  };

  it('SHOULD match the closed lot with the same date, both null included, never an open lot', () => {
    expect(findEntryLot([open, closed], day('2026-11-20'))?.id).toBe('closed');
    expect(findEntryLot([closed, noDate], undefined)?.id).toBe('none');
    expect(findEntryLot([open], day('2026-11-20'))).toBeUndefined();
    expect(findEntryLot([closed], day('2026-11-21'))).toBeUndefined();
  });
});

describe('defaultOpenLot / planOpen', () => {
  it('SHOULD pick the closed lot with the earliest expiration', () => {
    const lots = [
      { id: 'o', openedAt: day('2026-11-01'), quantity: 1 },
      { expirationDate: day('2026-12-01'), id: 'b', quantity: 1 },
      { expirationDate: day('2026-11-01'), id: 'a', quantity: 1 },
      { id: 'z', quantity: 0 },
    ];

    expect(defaultOpenLot(lots)?.id).toBe('a');
    expect(defaultOpenLot([])).toBeUndefined();
  });

  it('SHOULD split WHEN part of the lot stays closed and cap to the lot quantity', () => {
    expect(planOpen({ id: 'a', quantity: 3 }, 1)).toEqual({ openedQuantity: 1, split: true });
    expect(planOpen({ id: 'a', quantity: 3 }, 3)).toEqual({ openedQuantity: 3, split: false });
    expect(planOpen({ id: 'a', quantity: 3 }, 9)).toEqual({ openedQuantity: 3, split: false });
  });
});
