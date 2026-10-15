import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD query every accessible owner, attach the balances AND sort ACTIVE first, then name case-insensitively', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    today: '2026-10-15',
  });

  expect(mocks.accountRepository.findAccounts).toHaveBeenCalledWith(mocks.accessibleOwners);
  expect(mocks.attach.execute).toHaveBeenCalledWith({
    accounts: expect.arrayContaining([mocks.accounts.activeAlpha]),
    today: '2026-10-15',
  });
  expect(result.map((item) => item.account.name)).toEqual(['Alpha', 'beta', 'Zed', 'alpha']);
  expect(result[0].balance).toBe(mocks.accounts.activeAlpha.ledgerBalance);
});

it('SHOULD narrow to the requested ownerIds', async () => {
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    ownerIds: [mocks.familyId],
    today: '2026-10-15',
  });

  expect(mocks.accountRepository.findAccounts).toHaveBeenCalledWith([
    { owner: OwnerType.FAMILY, ownerId: mocks.familyId },
  ]);
});

it('SHOULD return [] WITHOUT querying WHEN every requested id is inaccessible (never an error)', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    ownerIds: ['not-mine'],
    today: '2026-10-15',
  });

  expect(result).toEqual([]);
  expect(mocks.accountRepository.findAccounts).not.toHaveBeenCalled();
});

it('SHOULD return [] WITHOUT querying WHEN there is no accessible owner', async () => {
  expect(await setup.execute({ accessibleOwners: [], today: '2026-10-15' })).toEqual([]);
  expect(mocks.accountRepository.findAccounts).not.toHaveBeenCalled();
});

it('SHOULD return [] WHEN the owners have no account', async () => {
  mocks.accountRepository.findAccounts.mockResolvedValueOnce([]);

  expect(
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, today: '2026-10-15' }),
  ).toEqual([]);
});

it('SHOULD throw ValidationError WHEN accessibleOwners is malformed', async () => {
  await expect(
    setup.execute({
      accessibleOwners: [{ owner: 'X', ownerId: '' }],
      today: '2026-10-15',
    } as never),
  ).rejects.toThrow(ValidationError);
});

it('SHOULD throw ValidationError WHEN today is missing or impossible', async () => {
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners } as never),
  ).rejects.toThrow(ValidationError);
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, today: '2026-02-30' }),
  ).rejects.toThrow(ValidationError);
  expect(mocks.accountRepository.findAccounts).not.toHaveBeenCalled();
});
