import { ForbiddenException } from '@nestjs/common';

import { INT4_MAX, INT4_MIN } from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD create the account with its initial balance for an accessible owner AND return it with its balances', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.accountRepository.createAccount).toHaveBeenCalledWith({
    currency: 'BRL' as const,
    icon: 'bank',
    initialBalance: 152075,
    name: 'Checking',
    owner: OwnerType.USER,
    ownerId: mocks.input.ownerId,
    status: AccountStatus.ACTIVE,
  });
  expect(mocks.attach.execute).toHaveBeenCalledWith({
    accounts: [mocks.account],
    today: mocks.input.today,
  });
  expect(result).toBe(mocks.withBalances);
});

it('SHOULD default initialBalance to 0 AND status to ACTIVE', async () => {
  await setup.execute({ ...mocks.input, initialBalance: undefined });

  expect(mocks.accountRepository.createAccount).toHaveBeenCalledWith(
    expect.objectContaining({ initialBalance: 0, status: AccountStatus.ACTIVE }),
  );
});

it('SHOULD trim name and icon', async () => {
  await setup.execute({ ...mocks.input, icon: ' bank ', name: '  Checking ' });

  expect(mocks.accountRepository.createAccount).toHaveBeenCalledWith(
    expect.objectContaining({ icon: 'bank', name: 'Checking' }),
  );
});

it('SHOULD accept a negative initial balance AND the int4 bounds', async () => {
  await setup.execute({ ...mocks.input, initialBalance: INT4_MIN });
  await setup.execute({ ...mocks.input, initialBalance: INT4_MAX });

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
  ['non-integer initial balance', { initialBalance: 12.5 }],
  ['initial balance above int4', { initialBalance: INT4_MAX + 1 }],
  ['initial balance below int4', { initialBalance: INT4_MIN - 1 }],
  ['string initial balance', { initialBalance: '100' }],
  ['empty name', { name: '' }],
  ['whitespace-only name', { name: '   ' }],
  ['61-character name', { name: 'a'.repeat(61) }],
  ['empty icon', { icon: '' }],
  ['51-character icon', { icon: 'a'.repeat(51) }],
  ['invalid owner', { owner: 'GROUP' }],
  ['invalid status', { status: 'DELETED' }],
  ['missing today', { today: undefined }],
])('SHOULD throw ValidationError WHEN %s', async (_label, patch) => {
  await expect(setup.execute({ ...mocks.input, ...patch } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.accountRepository.createAccount).not.toHaveBeenCalled();
});

describe('currency (spec 040)', () => {
  it('SHOULD forward the sent currency AND reject an unsupported one', async () => {
    await setup.execute({ ...mocks.input, currency: 'EUR' });

    expect(mocks.accountRepository.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'EUR' }),
    );
    await expect(setup.execute({ ...mocks.input, currency: 'XYZ' as never })).rejects.toThrow();
  });
});
