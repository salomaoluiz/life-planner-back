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

it('SHOULD allow archiving AND end the recurring series of the account (spec 034)', async () => {
  await setup.execute({ ...base(), status: AccountStatus.ARCHIVED });

  expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith(
    expect.objectContaining({ status: AccountStatus.ARCHIVED }),
  );
  expect(mocks.endRecurrences.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    accountId: mocks.account.id,
  });
});

it('SHOULD NOT end series WHEN the account was already archived OR is not being archived', async () => {
  mocks.accountRepository.findAccountById.mockResolvedValueOnce({
    ...mocks.account,
    status: AccountStatus.ARCHIVED,
  });
  await setup.execute({ ...base(), status: AccountStatus.ARCHIVED });
  await setup.execute({ ...base(), status: AccountStatus.ACTIVE });
  await setup.execute({ ...base(), name: 'x' });

  expect(mocks.endRecurrences.execute).not.toHaveBeenCalled();
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

describe('archivedAt (spec 052)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-10T15:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  it('SHOULD set archivedAt to now WHEN archiving', async () => {
    await setup.execute({ ...base(), status: AccountStatus.ARCHIVED });

    expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: new Date('2026-10-10T15:00:00Z') }),
    );
  });

  it('SHOULD clear archivedAt WHEN reactivating', async () => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce({
      ...mocks.account,
      status: AccountStatus.ARCHIVED,
    });
    await setup.execute({ ...base(), status: AccountStatus.ACTIVE });

    expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: null }),
    );
  });

  it('SHOULD NOT move archivedAt WHEN the status does not change', async () => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce({
      ...mocks.account,
      status: AccountStatus.ARCHIVED,
    });
    await setup.execute({ ...base(), status: AccountStatus.ARCHIVED });

    expect(mocks.accountRepository.updateAccount.mock.calls[0][0].archivedAt).toBeUndefined();
  });
});
