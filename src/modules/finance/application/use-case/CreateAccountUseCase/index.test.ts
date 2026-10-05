import { ForbiddenException } from '@nestjs/common';

import { INT4_MAX, INT4_MIN } from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD create the account for an accessible owner AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.accountRepository.createAccount).toHaveBeenCalledWith({
    balance: 152075,
    icon: 'bank',
    name: 'Checking',
    owner: OwnerType.USER,
    ownerId: mocks.input.ownerId,
    status: AccountStatus.ACTIVE,
  });
  expect(result).toBe(mocks.account);
});

it('SHOULD default balance to 0 AND status to ACTIVE', async () => {
  await setup.execute({ ...mocks.input, balance: undefined });

  expect(mocks.accountRepository.createAccount).toHaveBeenCalledWith(
    expect.objectContaining({ balance: 0, status: AccountStatus.ACTIVE }),
  );
});

it('SHOULD trim name and icon', async () => {
  await setup.execute({ ...mocks.input, icon: ' bank ', name: '  Checking ' });

  expect(mocks.accountRepository.createAccount).toHaveBeenCalledWith(
    expect.objectContaining({ icon: 'bank', name: 'Checking' }),
  );
});

it('SHOULD accept a negative balance AND the int4 bounds', async () => {
  await setup.execute({ ...mocks.input, balance: INT4_MIN });
  await setup.execute({ ...mocks.input, balance: INT4_MAX });

  expect(mocks.accountRepository.createAccount).toHaveBeenCalledTimes(2);
});

it.each([
  ['a USER id that is not the caller', { owner: OwnerType.USER, ownerId: 'someone-else' }],
  [
    'a FAMILY the caller does not belong to (or only has a pending invite for)',
    { owner: OwnerType.FAMILY, ownerId: 'family-x' },
  ],
])(
  'SHOULD throw Forbidden (403) AND create nothing WHEN the owner is %s',
  async (_label, owner) => {
    await expect(setup.execute({ ...mocks.input, ...owner })).rejects.toThrow(ForbiddenException);
    expect(mocks.accountRepository.createAccount).not.toHaveBeenCalled();
  },
);

it.each([
  ['non-integer balance', { balance: 12.5 }],
  ['balance above int4', { balance: INT4_MAX + 1 }],
  ['balance below int4', { balance: INT4_MIN - 1 }],
  ['string balance', { balance: '100' }],
  ['empty name', { name: '' }],
  ['whitespace-only name', { name: '   ' }],
  ['61-character name', { name: 'a'.repeat(61) }],
  ['empty icon', { icon: '' }],
  ['51-character icon', { icon: 'a'.repeat(51) }],
  ['invalid owner', { owner: 'GROUP' }],
  ['invalid status', { status: 'DELETED' }],
])('SHOULD throw ValidationError WHEN %s', async (_label, patch) => {
  await expect(setup.execute({ ...mocks.input, ...patch } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.accountRepository.createAccount).not.toHaveBeenCalled();
});
