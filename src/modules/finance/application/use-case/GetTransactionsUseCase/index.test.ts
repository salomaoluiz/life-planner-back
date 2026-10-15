import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD return the repository result as-is (the repository already sorts date desc, createdAt desc)', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    'ACCOUNT',
    { creditCardId: undefined, invoiceMonth: undefined },
  );
  expect(result).toBe(mocks.transactions);
});

it('SHOULD narrow to the requested ownerIds', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['family-id'] });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    [{ owner: OwnerType.FAMILY, ownerId: 'family-id' }],
    'ACCOUNT',
    { creditCardId: undefined, invoiceMonth: undefined },
  );
});

it('SHOULD return [] WITHOUT querying WHEN no requested id is accessible (never an error)', async () => {
  expect(
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['stranger'] }),
  ).toEqual([]);
  expect(mocks.transactionRepository.findTransactions).not.toHaveBeenCalled();
});

it('SHOULD return [] WHEN the owners have no transactions', async () => {
  mocks.transactionRepository.findTransactions.mockResolvedValueOnce([]);

  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners })).toEqual([]);
});

it('SHOULD pass the CARD source and its filters through', async () => {
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    creditCardId: 'card-1',
    invoiceMonth: '2026-10',
    source: 'CARD' as never,
  });

  expect(mocks.transactionRepository.findTransactions).toHaveBeenCalledWith(
    mocks.accessibleOwners,
    'CARD',
    { creditCardId: 'card-1', invoiceMonth: '2026-10' },
  );
});
