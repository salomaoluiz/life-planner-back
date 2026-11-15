import { mocks, setup, spies } from './index.mocks';

it('SHOULD map an income AND answer undefined WHEN it does not exist', async () => {
  spies.findIncomeById.mockResolvedValueOnce(mocks.incomeRow);
  expect(await setup.findIncomeById('inc-1')).toMatchObject({ id: 'inc-1', paid: true });

  spies.findIncomeById.mockResolvedValueOnce(null);
  expect(await setup.findIncomeById('x')).toBeUndefined();
});

it('SHOULD map the list AND pass the filter through', async () => {
  spies.findIncomes.mockResolvedValue([mocks.incomeRow]);
  const filter = { limit: 51, owners: [] };

  expect(await setup.findIncomes(filter)).toHaveLength(1);
  expect(spies.findIncomes).toHaveBeenCalledWith(filter);
});

it('SHOULD map the link by transaction id', async () => {
  spies.findIncomeByTransactionId.mockResolvedValueOnce({ asset_id: 'asset-1', id: 'inc-1' });
  expect(await setup.findIncomeByTransactionId('tx-1')).toEqual({
    assetId: 'asset-1',
    incomeId: 'inc-1',
  });

  spies.findIncomeByTransactionId.mockResolvedValueOnce(null);
  expect(await setup.findIncomeByTransactionId('tx-2')).toBeUndefined();
});

it('SHOULD turn null defaults into undefined', async () => {
  spies.findDefaultAccountId.mockResolvedValueOnce(null);
  spies.findLastIncomeCategoryId.mockResolvedValueOnce(null);
  spies.findCategoryById.mockResolvedValueOnce(null);
  spies.findSuggestionById.mockResolvedValueOnce(null);

  expect(await setup.findDefaultAccountId('a')).toBeUndefined();
  expect(
    await setup.findLastIncomeCategoryId('USER' as never, 'u', 'JCP' as never),
  ).toBeUndefined();
  expect(await setup.findCategoryById('c')).toBeUndefined();
  expect(await setup.findSuggestionById('s')).toBeUndefined();
});

it('SHOULD map pending suggestions, AND skip the read WHEN there is no asset', async () => {
  expect(await setup.findPendingSuggestions([])).toEqual([]);
  expect(spies.findPendingSuggestions).not.toHaveBeenCalled();

  spies.findPendingSuggestions.mockResolvedValue([
    {
      asset_id: 'asset-1',
      event: mocks.event,
      event_id: 'ev-1',
      id: 'sug-1',
      quantity: { toFixed: () => '300.00000000' },
      status: 'PENDING',
    },
  ]);

  expect(await setup.findPendingSuggestions(['asset-1'])).toMatchObject([
    { id: 'sug-1', quantity: '300' },
  ]);
});

it('SHOULD map the matcher inputs to domain keys AND dates', async () => {
  spies.findSuggestionInputs.mockResolvedValue({
    assets: [
      {
        asset_id: 'asset-1',
        market: 'B3',
        operations: [
          {
            created_at: new Date('2026-01-01T00:00:00Z'),
            date: new Date('2026-01-10T00:00:00Z'),
            id: 'op-1',
            quantity: { toFixed: () => '300.00000000' },
            total: 1000,
            type: 'BUY',
          },
        ],
        ticker: 'PETR4',
      },
    ],
    existing: [{ asset_id: 'asset-1', event_id: 'ev-1' }],
    incomes: [
      {
        asset_id: 'asset-1',
        ex_date: new Date('2026-09-10T00:00:00Z'),
        payment_date: new Date('2026-10-30T00:00:00Z'),
        type: 'JCP',
      },
    ],
  });

  expect(await setup.findSuggestionInputs([])).toMatchObject({
    assets: [{ assetId: 'asset-1', operations: [{ date: '2026-01-10' }], ticker: 'PETR4' }],
    existing: ['asset-1:ev-1'],
    incomes: [{ exDate: '2026-09-10', paymentDate: '2026-10-30', type: 'JCP' }],
  });
});

it('SHOULD convert the dates it sends to the datasource', async () => {
  spies.findEvents.mockResolvedValue([mocks.event]);
  spies.incomeTotals.mockResolvedValue({ planned: 1, received: 2 });

  expect(await setup.findEvents([], '2026-01-01')).toMatchObject([{ exDate: '2026-11-21' }]);
  expect(spies.findEvents).toHaveBeenCalledWith([], new Date('2026-01-01T00:00:00Z'));
  expect(await setup.incomeTotals('asset-1', '2026-01-01', '2026-12-31')).toEqual({
    planned: 1,
    received: 2,
  });
});

it('SHOULD translate suggestion rows AND delegate the writes', async () => {
  spies.createSuggestions.mockResolvedValue(1);
  spies.upsertEvents.mockResolvedValue([mocks.event]);
  spies.writeIncome.mockResolvedValue('inc-1');
  spies.runExclusive.mockResolvedValue(true);
  spies.countPendingSuggestions.mockResolvedValue(3);

  expect(await setup.createSuggestions([{ assetId: 'a', eventId: 'e', quantity: '1' }])).toBe(1);
  expect(spies.createSuggestions).toHaveBeenCalledWith([
    { asset_id: 'a', event_id: 'e', quantity: '1' },
  ]);
  expect(await setup.upsertEvents([])).toHaveLength(1);
  expect(await setup.writeIncome({} as never)).toBe('inc-1');
  expect(await setup.runExclusive(1, jest.fn())).toBe(true);
  expect(await setup.countPendingSuggestions('a')).toBe(3);

  await setup.deleteIncome('inc-1');
  await setup.rejectSuggestion('sug-1', 'user-1');

  expect(spies.deleteIncome).toHaveBeenCalledWith('inc-1');
  expect(spies.rejectSuggestion).toHaveBeenCalledWith('sug-1', 'user-1');
});

describe('home summary reads (spec 109)', () => {
  it('SHOULD send the month as dates AND map the received rows', async () => {
    spies.findReceivedByOwners.mockResolvedValue([{ currency: 'USD', net_amount: 1000 }]);
    const owners = [{ owner: 'USER' as never, ownerId: 'user-1' }];

    expect(await setup.findReceivedByOwners(owners, '2026-11-01', '2026-11-30')).toEqual([
      { currency: 'USD', netAmount: 1000 },
    ]);
    expect(spies.findReceivedByOwners).toHaveBeenCalledWith(
      owners,
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-11-30T00:00:00Z'),
    );
  });

  it('SHOULD delegate the pending count by assets', async () => {
    spies.countPendingSuggestionsByAssets.mockResolvedValue(4);

    expect(await setup.countPendingSuggestionsByAssets(['a', 'b'])).toBe(4);
    expect(spies.countPendingSuggestionsByAssets).toHaveBeenCalledWith(['a', 'b']);
  });
});
