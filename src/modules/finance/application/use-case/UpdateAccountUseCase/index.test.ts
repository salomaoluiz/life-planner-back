import { NotFoundException } from '@nestjs/common';

import { INT4_MAX } from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

function base() {
  return { accessibleOwners: mocks.accessibleOwners, id: mocks.account.id };
}

it('SHOULD update only the sent fields AND return the updated account', async () => {
  const result = await setup.execute({ ...base(), name: ' Renamed ' });

  expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith({
    balance: undefined,
    icon: undefined,
    id: mocks.account.id,
    name: 'Renamed',
    status: undefined,
  });
  expect(result).toBe(mocks.updated);
});

it('SHOULD allow archiving AND a negative balance', async () => {
  await setup.execute({ ...base(), balance: -500, status: AccountStatus.ARCHIVED });

  expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith(
    expect.objectContaining({ balance: -500, status: AccountStatus.ARCHIVED }),
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
  ['a non-integer balance', { balance: 1.5 }],
  ['a balance above int4', { balance: INT4_MAX + 1 }],
  ['an invalid status', { status: 'GONE' }],
])('SHOULD throw ValidationError WHEN the patch is %s', async (_label, patch) => {
  await expect(setup.execute({ ...base(), ...patch } as never)).rejects.toThrow(ValidationError);
  expect(mocks.accountRepository.updateAccount).not.toHaveBeenCalled();
});
