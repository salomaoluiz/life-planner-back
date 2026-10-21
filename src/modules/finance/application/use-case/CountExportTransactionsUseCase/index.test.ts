import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

const period = { from: '2026-01-01', to: '2026-12-31' };

it('SHOULD count the rows of every owner, archived families included, for ALL', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, ...period });

  expect(result).toEqual({ count: 7 });
  expect(mocks.transactionRepository.countTransactionsForExport).toHaveBeenCalledWith({
    accountIds: undefined,
    creditCardIds: undefined,
    ...period,
    owners: mocks.accessibleOwners,
  });
});

it('SHOULD return 0 without querying WHEN no owner is reachable', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    owner: 'FAMILY',
    ownerId: 'stranger',
    ...period,
  });

  expect(result).toEqual({ count: 0 });
  expect(mocks.transactionRepository.countTransactionsForExport).not.toHaveBeenCalled();
});

it('SHOULD refuse a period over 2 years', async () => {
  await expect(
    setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      from: '2020-01-01',
      to: '2026-12-31',
    }),
  ).rejects.toBeInstanceOf(ValidationError);
});
