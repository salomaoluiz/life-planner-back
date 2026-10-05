import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD query every accessible owner AND sort ACTIVE first, then name case-insensitively', async () => {
  const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners });

  expect(mocks.accountRepository.findAccounts).toHaveBeenCalledWith(mocks.accessibleOwners);
  expect(result.map((account) => account.name)).toEqual(['Alpha', 'beta', 'Zed', 'alpha']);
});

it('SHOULD narrow to the requested ownerIds', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: [mocks.familyId] });

  expect(mocks.accountRepository.findAccounts).toHaveBeenCalledWith([
    { owner: OwnerType.FAMILY, ownerId: mocks.familyId },
  ]);
});

it('SHOULD return [] WITHOUT querying WHEN every requested id is inaccessible (never an error)', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    ownerIds: ['not-mine'],
  });

  expect(result).toEqual([]);
  expect(mocks.accountRepository.findAccounts).not.toHaveBeenCalled();
});

it('SHOULD return [] WITHOUT querying WHEN there is no accessible owner', async () => {
  expect(await setup.execute({ accessibleOwners: [] })).toEqual([]);
  expect(mocks.accountRepository.findAccounts).not.toHaveBeenCalled();
});

it('SHOULD return [] WHEN the owners have no account', async () => {
  mocks.accountRepository.findAccounts.mockResolvedValueOnce([]);

  expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners })).toEqual([]);
});

it('SHOULD throw ValidationError WHEN accessibleOwners is malformed', async () => {
  await expect(
    setup.execute({ accessibleOwners: [{ owner: 'X', ownerId: '' }] } as never),
  ).rejects.toThrow(ValidationError);
});
