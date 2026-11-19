import { mocks, setup, spies } from './split-lookups.service.mocks';

it('SHOULD return the lookups untouched AND read nothing WHEN no row is a part', async () => {
  const result = await setup.attach(mocks.accessibleOwners, [mocks.rows[1]], mocks.lookups);

  expect(result).toBe(mocks.lookups);
  expect(spies.getSplitLookupsUseCase.execute).not.toHaveBeenCalled();
});

it('SHOULD add lookups.splits with the matched rows of the page (FR 27-28)', async () => {
  const result = await setup.attach(mocks.accessibleOwners, mocks.rows, mocks.lookups);

  expect(spies.getSplitLookupsUseCase.execute).toHaveBeenCalledTimes(1);
  expect(spies.getSplitLookupsUseCase.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    splitIds: ['split-1', 'split-1'],
  });
  expect(result.splits).toEqual({
    'split-1': {
      description: 'Mercado',
      matchedCount: 2,
      matchedTotal: 5700,
      notes: 'Compra',
      occurrenceNumber: 2,
      paid: true,
      partCount: 6,
      recurrenceId: 'rec-1',
      total: 28000,
      type: 'EXPENSE',
    },
  });
});
