import { ForbiddenException } from '@nestjs/common';

import { mocks, setup, spies } from './month.service.mocks';

const today = '2026-11-02';

it('SHOULD resolve access AND materialize the recurrences once, for the owners asked', async () => {
  const ownerIds = [mocks.userId];

  await setup.find(mocks.userId, '2026-11', ownerIds, undefined, today);

  expect(mocks.financeAccessService.resolve).toHaveBeenCalledTimes(1);
  expect(mocks.materializeRecurrencesUseCase.execute).toHaveBeenCalledTimes(1);
  expect(mocks.materializeRecurrencesUseCase.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    ownerIds,
    today,
  });
});

it('SHOULD read the month window of the rows, the invoices AND the balances, with the filter', async () => {
  const filter = { q: 'gym' };

  const result = await setup.find(mocks.userId, '2026-11', undefined, filter, today);

  expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    filter: { from: '2026-11-01', q: 'gym', to: '2026-11-30' },
    limit: 500,
    ownerIds: undefined,
    today,
  });
  expect(mocks.getInvoicesForListUseCase.execute).toHaveBeenCalledWith(
    expect.objectContaining({ filter, month: '2026-11' }),
  );
  expect(mocks.getDailyBalancesUseCase.execute).toHaveBeenCalledWith(
    expect.objectContaining({ month: '2026-11' }),
  );
  expect(result.month).toBe('2026-11');
  expect(result.rows).toEqual({
    items: [expect.objectContaining({ id: mocks.row.id })],
    nextCursor: null,
  });
  expect(result.lookups.categories[mocks.row.categoryId]).toBeDefined();
  expect(result.summary).toEqual(mocks.summary);
});

it('SHOULD NOT project for the current or a past month', async () => {
  await setup.find(mocks.userId, '2026-11', undefined, undefined, today);
  await setup.find(mocks.userId, '2026-09', undefined, undefined, today);

  expect(mocks.getProjectionsUseCase.execute).not.toHaveBeenCalled();
});

it('SHOULD project from two months back (but after the current month) up to the month', async () => {
  await setup.find(mocks.userId, '2027-01', undefined, undefined, today);
  await setup.find(mocks.userId, '2026-12', undefined, undefined, today);

  expect(mocks.getProjectionsUseCase.execute).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ from: '2026-12', to: '2027-01' }),
  );
  expect(mocks.getProjectionsUseCase.execute).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ from: '2026-12', to: '2026-12' }),
  );
});

it('SHOULD give the summary ALL the rows by following the next cursors, AND answer only the first page', async () => {
  const second = { ...mocks.row, id: 'second' };

  mocks.getTransactionsUseCase.execute
    .mockResolvedValueOnce({ items: [mocks.row], nextCursor: 'cursor-1' })
    .mockResolvedValueOnce({ items: [second], nextCursor: null });

  const result = await setup.find(mocks.userId, '2026-11', undefined, undefined, today);

  expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledTimes(2);
  expect(mocks.getTransactionsUseCase.execute).toHaveBeenLastCalledWith(
    expect.objectContaining({ cursor: 'cursor-1' }),
  );
  expect(mocks.getMonthSummaryUseCase.execute).toHaveBeenCalledWith(
    expect.objectContaining({ accountRows: [mocks.row, second] }),
  );
  expect(result.rows.items).toHaveLength(1);
  expect(result.rows.nextCursor).toBe('cursor-1');
});

it('SHOULD answer empty balances instead of failing for a month past the balance horizon', async () => {
  const result = await setup.find(mocks.userId, '2030-01', undefined, undefined, today);

  expect(mocks.getDailyBalancesUseCase.execute).not.toHaveBeenCalled();
  expect(result.dailyBalances).toEqual({ accounts: [], days: [], month: '2030-01' });
});

it('SHOULD propagate Forbidden (403) from a use case', async () => {
  mocks.getTransactionsUseCase.execute.mockRejectedValueOnce(new ForbiddenException());

  await expect(setup.find(mocks.userId, '2026-11', undefined, undefined, today)).rejects.toThrow(
    ForbiddenException,
  );
});

it('SHOULD read the filter categories ONCE AND hand them to the rows, the invoices AND the projections (spec 083)', async () => {
  const categories = [{ id: 'market' }] as never;
  const filter = { categoryIds: ['market'], q: 'gym' };

  mocks.loadFilterCategoriesUseCase.execute.mockResolvedValue(categories);

  await setup.find(mocks.userId, '2027-01', undefined, filter, today);

  expect(mocks.loadFilterCategoriesUseCase.execute).toHaveBeenCalledTimes(1);
  expect(mocks.loadFilterCategoriesUseCase.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    filter,
  });

  for (const useCase of [
    mocks.getTransactionsUseCase,
    mocks.getInvoicesForListUseCase,
    mocks.getProjectionsUseCase,
  ]) {
    expect(useCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ preloaded: { categories } }),
    );
  }
});

it('SHOULD attach the transfer lookups of the month rows (spec 098)', async () => {
  const attached = { accounts: {}, categories: {}, creditCards: {}, tags: {}, transfers: {} };
  spies.transferLookupsService.attach.mockResolvedValueOnce(attached as never);

  const result = await setup.find(mocks.userId, '2026-11', undefined, undefined, today);

  expect(result.lookups).toBe(attached);
  expect(spies.transferLookupsService.attach).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    expect.any(Array),
    expect.any(Object),
  );
});
