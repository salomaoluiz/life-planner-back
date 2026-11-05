import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { AccountStatus } from '@finance/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

function base() {
  return { accessibleOwners: mocks.accessibleOwners, id: mocks.account.id, today: '2026-10-15' };
}

it('SHOULD update only the sent fields AND return the account with its balances', async () => {
  const result = await setup.execute({ ...base(), name: ' Renamed ' });

  expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith({
    clearFavorites: false,
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

describe('favorite account (spec 094)', () => {
  const userId = 'user-id';

  it('SHOULD set the favorite of the user AND skip the account write WHEN only isFavorite is sent', async () => {
    await setup.execute({ ...base(), isFavorite: true, userId });

    expect(mocks.favoriteRepository.set).toHaveBeenCalledWith(userId, mocks.account.id);
    expect(mocks.accountRepository.updateAccount).not.toHaveBeenCalled();
    expect(mocks.attach.execute).toHaveBeenCalledWith({
      accounts: [mocks.account],
      today: '2026-10-15',
    });
  });

  it('SHOULD clear the favorite only for that account WHEN isFavorite is false', async () => {
    await setup.execute({ ...base(), isFavorite: false, userId });

    expect(mocks.favoriteRepository.clear).toHaveBeenCalledWith(userId, mocks.account.id);
    expect(mocks.favoriteRepository.set).not.toHaveBeenCalled();
  });

  it('SHOULD NOT touch the favorite WHEN isFavorite is omitted', async () => {
    await setup.execute({ ...base(), name: 'x', userId });

    expect(mocks.favoriteRepository.set).not.toHaveBeenCalled();
    expect(mocks.favoriteRepository.clear).not.toHaveBeenCalled();
  });

  it.each([
    ['the account is already archived', { isFavorite: true }, AccountStatus.ARCHIVED],
    [
      'archiving in the same request',
      { isFavorite: true, status: AccountStatus.ARCHIVED },
      AccountStatus.ACTIVE,
    ],
  ])('SHOULD throw 422 AND write nothing WHEN %s', async (_label, patch, current) => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce({
      ...mocks.account,
      status: current,
    });

    await expect(setup.execute({ ...base(), ...patch, userId })).rejects.toThrow(
      new UnprocessableEntityException("An archived account can't be the favorite"),
    );
    expect(mocks.accountRepository.updateAccount).not.toHaveBeenCalled();
    expect(mocks.favoriteRepository.set).not.toHaveBeenCalled();
  });

  it('SHOULD ask the repository to clear the favorite of every user WHEN archiving', async () => {
    await setup.execute({ ...base(), status: AccountStatus.ARCHIVED, userId });

    expect(mocks.accountRepository.updateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ clearFavorites: true }),
    );
  });

  it('SHOULD NOT clear favorites WHEN reactivating OR already archived', async () => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce({
      ...mocks.account,
      status: AccountStatus.ARCHIVED,
    });
    await setup.execute({ ...base(), status: AccountStatus.ACTIVE, userId });
    mocks.accountRepository.findAccountById.mockResolvedValueOnce({
      ...mocks.account,
      status: AccountStatus.ARCHIVED,
    });
    await setup.execute({ ...base(), status: AccountStatus.ARCHIVED, userId });

    for (const [call] of mocks.accountRepository.updateAccount.mock.calls) {
      expect(call.clearFavorites).toBeFalsy();
    }
    expect(mocks.favoriteRepository.set).not.toHaveBeenCalled();
  });

  it('SHOULD throw 404 AND not set the favorite WHEN the account is not readable', async () => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce({
      ...mocks.account,
      ownerId: 'someone-else',
    });

    await expect(setup.execute({ ...base(), isFavorite: true, userId })).rejects.toThrow(
      NotFoundException,
    );
    expect(mocks.favoriteRepository.set).not.toHaveBeenCalled();
  });

  it('SHOULD throw ValidationError WHEN isFavorite comes without userId', async () => {
    await expect(setup.execute({ ...base(), isFavorite: true })).rejects.toThrow(ValidationError);
  });
});
