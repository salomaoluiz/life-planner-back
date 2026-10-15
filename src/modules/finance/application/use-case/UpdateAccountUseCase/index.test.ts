import { NotFoundException } from '@nestjs/common';

import { AccountStatus } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

function base() {
  return { accessibleOwners: mocks.accessibleOwners, id: mocks.account.id, today: '2026-10-15' };
}

it('SHOULD update only the sent fields AND return the account with its balances', async () => {
  const result = await setup.execute({ ...base(), name: ' Renamed ' });

  expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith({
    icon: undefined,
    id: mocks.account.id,
    name: 'Renamed',
    status: undefined,
  });
  expect(mocks.attach.execute).toHaveBeenCalledWith({
    accounts: [mocks.updated],
    today: '2026-10-15',
  });
  expect(result).toBe(mocks.withBalances);
});

it('SHOULD allow archiving', async () => {
  await setup.execute({ ...base(), status: AccountStatus.ARCHIVED });

  expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith(
    expect.objectContaining({ status: AccountStatus.ARCHIVED }),
  );
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.account, ownerId: 'someone-else' }],
])(
  'SHOULD throw NotFound (404) AND update nothing WHEN the account is %s',
  async (_label, found) => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce(found);

    await expect(setup.execute({ ...base(), name: 'x' })).rejects.toThrow(NotFoundException);
    expect(mocks.accountRepository.updateAccount).not.toHaveBeenCalled();
  },
);

it.each([
  ['an empty patch', {}],
  ['a whitespace-only name', { name: '   ' }],
  ['a 61-character name', { name: 'a'.repeat(61) }],
  ['an invalid status', { status: 'GONE' }],
  ['a missing today', { name: 'x', today: undefined }],
])('SHOULD throw ValidationError WHEN the patch is %s', async (_label, patch) => {
  await expect(setup.execute({ ...base(), ...patch } as never)).rejects.toThrow(ValidationError);
  expect(mocks.accountRepository.updateAccount).not.toHaveBeenCalled();
});
