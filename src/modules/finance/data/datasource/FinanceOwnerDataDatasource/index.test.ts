import { setup, spies } from './index.mocks';

it('SHOULD delete transactions, then categories, then accounts of ONE owner in ONE transaction AND return the total', async () => {
  spies.transactionDeleteMany.mockReturnValueOnce('tx-op');
  spies.categoryDeleteMany.mockReturnValueOnce('cat-op');
  spies.accountDeleteMany.mockReturnValueOnce('acc-op');
  spies.transaction.mockResolvedValueOnce([{ count: 4 }, { count: 3 }, { count: 2 }]);

  const result = await setup.deleteAllByOwner({ owner: 'USER', owner_id: 'user-id' });

  const where = { where: { owner: 'USER', owner_id: 'user-id' } };
  expect(spies.transactionDeleteMany).toHaveBeenCalledWith(where);
  expect(spies.categoryDeleteMany).toHaveBeenCalledWith(where);
  expect(spies.accountDeleteMany).toHaveBeenCalledWith(where);
  expect(spies.transaction).toHaveBeenCalledWith(['tx-op', 'cat-op', 'acc-op']);
  expect(result).toBe(9);
});

it('SHOULD return 0 WHEN the owner has nothing (second call of a retry)', async () => {
  spies.transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }, { count: 0 }]);

  expect(await setup.deleteAllByOwner({ owner: 'FAMILY', owner_id: 'family-id' })).toBe(0);
});

it('SHOULD propagate a transaction failure (Prisma rolls everything back)', async () => {
  spies.transaction.mockRejectedValueOnce(new Error('fk violation'));

  await expect(setup.deleteAllByOwner({ owner: 'USER', owner_id: 'user-id' })).rejects.toThrow(
    'fk violation',
  );
});
