import { mocks, setup, spies } from './transfer.service.mocks';

const body = {
  amountOut: 100000,
  dateOut: '2026-11-04',
  description: 'Savings',
  fromAccountId: 'a',
  paid: true,
  toAccountId: 'b',
};

it('SHOULD add the accessible owners AND the requester on create, then return the item, its rows and lookups', async () => {
  const result = await setup.create(mocks.userId, body, '2026-11-09');

  expect(spies.createTransfer.execute).toHaveBeenCalledWith({
    ...body,
    accessibleOwners: mocks.accessibleOwners,
    requesterId: mocks.userId,
    today: '2026-11-09',
  });
  expect(spies.getTransaction.execute).toHaveBeenCalledTimes(mocks.sameCurrency.rowIds.length);
  expect(result.item).toMatchObject({
    amountIn: mocks.sameCurrency.amountIn,
    id: mocks.sameCurrency.id,
  });
  expect(result.item.rate).toBeUndefined();
  expect(result.rows).toHaveLength(mocks.sameCurrency.rowIds.length);
  expect(result.lookups.categories[mocks.row.categoryId]).toBeDefined();
});

it('SHOULD derive the rate with 4 decimals for different currencies AND show the fee', async () => {
  spies.getTransfer.execute.mockResolvedValueOnce(mocks.crossCurrency);

  const result = await setup.findById(mocks.userId, mocks.crossCurrency.id);

  expect(result.item.rate).toEqual({ base: 'IN', value: 5.4348 });
  expect(result.item.fee).toBe(350);
});

it('SHOULD omit the rate while the amount in is unknown', async () => {
  spies.getTransfer.execute.mockResolvedValueOnce({ ...mocks.crossCurrency, amountIn: null });

  expect((await setup.findById(mocks.userId, 'id')).item.rate).toBeUndefined();
});

it('SHOULD attach the transfer lookups to the response', async () => {
  await setup.findById(mocks.userId, mocks.sameCurrency.id);

  expect(spies.transferLookupsService.attach).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    expect.any(Array),
    expect.any(Object),
  );
});

it('SHOULD update AND delete with the accessible owners', async () => {
  await setup.update(mocks.userId, 'id', { paid: false });
  await setup.delete(mocks.userId, 'id', 'THIS_AND_NEXT' as never);

  expect(spies.updateTransfer.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    id: 'id',
    paid: false,
  });
  expect(spies.deleteTransfer.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    id: 'id',
    scope: 'THIS_AND_NEXT',
  });
});
