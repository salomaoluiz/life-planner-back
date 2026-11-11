import { InvestmentCorporateEventType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

import { mocks, setup, spies } from './index.mocks';

describe('CorporateEventRepository', () => {
  it('SHOULD turn the pending counts into a map by asset', async () => {
    spies.countPendingByAsset.mockResolvedValue([{ asset_id: 'a', count: 2 }]);

    expect((await setup.countPendingByAsset(['a'])).get('a')).toBe(2);
  });

  it('SHOULD create suggestions with snake_case rows', async () => {
    spies.createSuggestions.mockResolvedValue(1);

    expect(await setup.createSuggestions([{ assetId: 'a', eventId: 'e', quantity: '315' }])).toBe(
      1,
    );
    expect(spies.createSuggestions).toHaveBeenCalledWith([
      { asset_id: 'a', event_id: 'e', quantity: '315' },
    ]);
  });

  it('SHOULD read events from a calendar day AND map them', async () => {
    spies.findEvents.mockResolvedValue([mocks.event]);

    const [event] = await setup.findEvents(
      [{ market: QuoteMarket.B3, ticker: 'MGLU3' }],
      '2025-11-19',
    );

    expect(spies.findEvents.mock.calls[0][1]).toEqual(new Date('2025-11-19T00:00:00.000Z'));
    expect(event).toMatchObject({ bonusPercent: '10', type: InvestmentCorporateEventType.BONUS });
  });

  it('SHOULD list AND read suggestions as entities', async () => {
    spies.findPendingSuggestions.mockResolvedValue([mocks.suggestion]);
    spies.findSuggestionById.mockResolvedValueOnce(mocks.suggestion).mockResolvedValueOnce(null);

    const [listed] = await setup.findPendingSuggestions(['asset-1'], 201, 'c');

    expect(spies.findPendingSuggestions).toHaveBeenCalledWith(['asset-1'], 201, 'c');
    expect(listed).toMatchObject({ id: 'sug-1', quantity: '315' });
    expect(await setup.findSuggestionById('sug-1')).toMatchObject({ eventId: 'ev-1' });
    expect(await setup.findSuggestionById('missing')).toBeNull();
  });

  it('SHOULD map the matcher inputs to domain operations AND keys', async () => {
    spies.findSuggestionInputs.mockResolvedValue({
      assets: [
        {
          asset_class: 'BR_STOCK',
          asset_id: 'asset-1',
          market: 'B3',
          operations: [
            {
              bonus_percent: null,
              bonus_unit_cost: null,
              created_at: new Date('2026-01-01T00:00:00Z'),
              date: new Date('2026-01-10T00:00:00Z'),
              fraction_of_operation_id: null,
              id: 'op-1',
              quantity: mocks.suggestion.quantity,
              ratio_from: null,
              ratio_to: null,
              total: 1000,
              type: 'BUY',
            },
          ],
          ticker: 'MGLU3',
        },
      ],
      existing: [{ asset_id: 'asset-1', event_id: 'ev-1' }],
    });

    const result = await setup.findSuggestionInputs([{ market: QuoteMarket.B3, ticker: 'MGLU3' }]);

    expect(result.existing).toEqual(['asset-1:ev-1']);
    expect(result.assets[0]).toMatchObject({ assetClass: 'BR_STOCK', market: QuoteMarket.B3 });
    expect(result.assets[0].operations[0]).toMatchObject({ date: '2026-01-10', id: 'op-1' });
  });

  it('SHOULD delegate reject, the lock and the upsert', async () => {
    spies.runExclusive.mockResolvedValue(true);
    spies.upsertEvents.mockResolvedValue(3);

    await setup.rejectSuggestion('sug-1', 'user-1');

    expect(spies.rejectSuggestion).toHaveBeenCalledWith('sug-1', 'user-1');
    expect(await setup.runExclusive(1, jest.fn())).toBe(true);
    expect(await setup.upsertEvents([])).toBe(3);
  });
});
