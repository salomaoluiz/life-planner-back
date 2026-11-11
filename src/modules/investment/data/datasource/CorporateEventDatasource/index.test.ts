import { InvestmentCorporateEventType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

import { setup, spies } from './index.mocks';

describe('countPendingByAsset', () => {
  it('SHOULD group the pending suggestions by asset', async () => {
    spies.suggestionGroupBy.mockResolvedValue([{ _count: { _all: 2 }, asset_id: 'a' }]);

    expect(await setup.countPendingByAsset(['a', 'b'])).toEqual([{ asset_id: 'a', count: 2 }]);
    expect(spies.suggestionGroupBy).toHaveBeenCalledWith({
      _count: { _all: true },
      by: ['asset_id'],
      where: { asset_id: { in: ['a', 'b'] }, status: 'PENDING' },
    });
  });

  it('SHOULD not query WHEN there are no assets', async () => {
    expect(await setup.countPendingByAsset([])).toEqual([]);
    expect(spies.suggestionGroupBy).not.toHaveBeenCalled();
  });
});

describe('createSuggestions', () => {
  it('SHOULD skip duplicates AND return how many were created', async () => {
    spies.suggestionCreateMany.mockResolvedValue({ count: 1 });
    const rows = [{ asset_id: 'a', event_id: 'e', quantity: '315' }];

    expect(await setup.createSuggestions(rows)).toBe(1);
    expect(spies.suggestionCreateMany).toHaveBeenCalledWith({ data: rows, skipDuplicates: true });
  });

  it('SHOULD not write WHEN there is nothing to create', async () => {
    expect(await setup.createSuggestions([])).toBe(0);
    expect(spies.suggestionCreateMany).not.toHaveBeenCalled();
  });
});

describe('findEvents', () => {
  it('SHOULD read the events of the tracked symbols from a data-com on', async () => {
    spies.eventFindMany.mockResolvedValue([]);
    const since = new Date('2025-11-01T00:00:00Z');

    await setup.findEvents([{ market: 'B3', ticker: 'MGLU3' }], since);

    expect(spies.eventFindMany).toHaveBeenCalledWith({
      orderBy: [{ record_date: 'asc' }, { id: 'asc' }],
      where: { OR: [{ market: 'B3', ticker: 'MGLU3' }], record_date: { gte: since } },
    });
  });

  it('SHOULD return [] WHEN no symbol is tracked', async () => {
    expect(await setup.findEvents([], new Date())).toEqual([]);
    expect(spies.eventFindMany).not.toHaveBeenCalled();
  });
});

describe('findPendingSuggestions', () => {
  it('SHOULD list pending ones newest data-com first, with the event', async () => {
    spies.suggestionFindMany.mockResolvedValue([]);

    await setup.findPendingSuggestions(['a'], 201);

    expect(spies.suggestionFindMany).toHaveBeenCalledWith({
      include: { event: true },
      orderBy: [{ event: { record_date: 'desc' } }, { id: 'asc' }],
      take: 201,
      where: { asset_id: { in: ['a'] }, status: 'PENDING' },
    });
  });

  it('SHOULD continue after a cursor', async () => {
    spies.suggestionFindMany.mockResolvedValue([]);

    await setup.findPendingSuggestions(['a'], 11, 'sug-9');

    expect(spies.suggestionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'sug-9' }, skip: 1 }),
    );
  });

  it('SHOULD read one suggestion with its event', async () => {
    spies.suggestionFindUnique.mockResolvedValue(null);

    expect(await setup.findSuggestionById('sug-1')).toBeNull();
    expect(spies.suggestionFindUnique).toHaveBeenCalledWith({
      include: { event: true },
      where: { id: 'sug-1' },
    });
  });
});

describe('findSuggestionInputs', () => {
  const operations = [{ id: 'op-1' }];

  it('SHOULD keep the assets quoted in the tracked market AND list the suggestions that exist', async () => {
    spies.assetFindMany.mockResolvedValue([
      { asset_class: 'BR_STOCK', id: 'a', operations, ticker: 'MGLU3' },
      { asset_class: 'FOREIGN_STOCK', id: 'b', operations, ticker: 'MGLU3' },
      { asset_class: 'BR_STOCK', id: 'c', operations, ticker: null },
    ]);
    spies.suggestionFindMany.mockResolvedValue([{ asset_id: 'a', event_id: 'e' }]);

    const result = await setup.findSuggestionInputs([{ market: 'B3', ticker: 'MGLU3' }]);

    expect(result.assets).toEqual([
      { asset_class: 'BR_STOCK', asset_id: 'a', market: 'B3', operations, ticker: 'MGLU3' },
    ]);
    expect(result.existing).toEqual([{ asset_id: 'a', event_id: 'e' }]);
    expect(spies.suggestionFindMany).toHaveBeenCalledWith({
      select: { asset_id: true, event_id: true },
      where: { asset_id: { in: ['a'] } },
    });
  });
});

describe('rejectSuggestion', () => {
  it('SHOULD mark it rejected with who decided AND when', async () => {
    await setup.rejectSuggestion('sug-1', 'user-1');

    expect(spies.suggestionUpdate).toHaveBeenCalledWith({
      data: { decided_at: expect.any(Date), decided_by: 'user-1', status: 'REJECTED' },
      where: { id: 'sug-1' },
    });
  });
});

describe('runExclusive', () => {
  it('SHOULD run the function WHEN the advisory lock is free', async () => {
    spies.queryRaw.mockResolvedValue([{ locked: true }]);
    const fn = jest.fn().mockResolvedValue(undefined);

    expect(await setup.runExclusive(108001, fn)).toBe(true);
    expect(fn).toHaveBeenCalled();
  });

  it('SHOULD skip WHEN another instance holds the lock', async () => {
    spies.queryRaw.mockResolvedValue([{ locked: false }]);
    const fn = jest.fn();

    expect(await setup.runExclusive(108001, fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('upsertEvents', () => {
  it('SHOULD upsert each event by its key, updating the same row on a later run', async () => {
    const row = {
      bonusPercent: null,
      bonusUnitCost: null,
      currency: 'BRL',
      eventKey: 'brapi:MGLU3:REVERSE_SPLIT:2026-03-10',
      fetchedAt: new Date('2026-11-11T22:00:00Z'),
      market: QuoteMarket.B3,
      ratioFrom: '10',
      ratioTo: '1',
      recordDate: '2026-03-10',
      source: 'brapi',
      ticker: 'MGLU3',
      type: InvestmentCorporateEventType.REVERSE_SPLIT,
    };

    expect(await setup.upsertEvents([row])).toBe(1);

    const data = {
      bonus_percent: null,
      bonus_unit_cost: null,
      currency: 'BRL',
      fetched_at: row.fetchedAt,
      market: 'B3',
      ratio_from: '10',
      ratio_to: '1',
      record_date: new Date('2026-03-10T00:00:00.000Z'),
      source: 'brapi',
      ticker: 'MGLU3',
      type: 'REVERSE_SPLIT',
    };

    expect(spies.eventUpsert).toHaveBeenCalledWith({
      create: { ...data, event_key: row.eventKey },
      update: data,
      where: { event_key: row.eventKey },
    });
  });
});
