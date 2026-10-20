import { ConflictException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete an accessible account', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.account.id });

  expect(mocks.accountRepository.deleteAccount).toHaveBeenCalledWith(mocks.account.id);
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.account, ownerId: 'someone-else' }],
])(
  'SHOULD throw NotFound (404) AND delete nothing WHEN the account is %s',
  async (_label, found) => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce(found);

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.account.id }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.accountRepository.deleteAccount).not.toHaveBeenCalled();
  },
);

it('SHOULD count the transactions by account id before deleting', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.account.id });

  expect(mocks.transactionRepository.countByAccountId).toHaveBeenCalledWith(mocks.account.id);
});

it.each([1, 3])(
  'SHOULD throw Conflict (409 "Account has transactions") AND delete nothing WHEN it has %i transactions',
  async (count) => {
    mocks.transactionRepository.countByAccountId.mockResolvedValueOnce(count);

    const promise = setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.account.id,
    });

    await expect(promise).rejects.toThrow(ConflictException);
    await expect(promise).rejects.toThrow('Account has transactions');
    expect(mocks.accountRepository.deleteAccount).not.toHaveBeenCalled();
  },
);

it('SHOULD answer 404 BEFORE counting WHEN the account is not accessible (no information leak)', async () => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    ownerId: 'stranger',
  });

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.account.id }),
  ).rejects.toThrow(NotFoundException);
  expect(mocks.transactionRepository.countByAccountId).not.toHaveBeenCalled();
});

describe('recurring transactions (spec 034)', () => {
  it('SHOULD answer 409 AND delete nothing WHEN the account has series', async () => {
    mocks.recurrenceRepository.countBySource.mockResolvedValue(1);

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.account.id }),
    ).rejects.toThrow('Account has recurring transactions');
    expect(mocks.recurrenceRepository.countBySource).toHaveBeenCalledWith({
      accountId: mocks.account.id,
    });
    expect(mocks.accountRepository.deleteAccount).not.toHaveBeenCalled();
  });
});

it('SHOULD throw 422 "Family is archived" WHEN the owner is archived (spec 042)', async () => {
  const input = { accessibleOwners: mocks.accessibleOwners, id: mocks.account.id };
  const accessibleOwners = input.accessibleOwners.map((access) => ({ ...access, archived: true }));

  await expect(setup.execute({ ...input, accessibleOwners })).rejects.toMatchObject({
    message: 'Family is archived',
    status: 422,
  });
});
