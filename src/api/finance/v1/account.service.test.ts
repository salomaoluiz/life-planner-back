import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './account.service.mocks';

const today = '2026-10-15';
const body = {
  icon: 'bank',
  initialBalance: 100000,
  name: 'Checking',
  owner: 'USER' as const,
  ownerId: mocks.userId,
  status: 'ACTIVE' as const,
};

describe('create', () => {
  it('SHOULD resolve the accessible owners, call the use case AND return the API shape (ISO dates)', async () => {
    const result = await setup.create(mocks.userId, body as never, today);

    expect(mocks.financeAccessService.resolve).toHaveBeenCalledWith(mocks.userId);
    expect(mocks.createAccountUseCase.execute).toHaveBeenCalledWith({
      ...body,
      accessibleOwners: mocks.accessibleOwners,
      today,
      userId: mocks.userId,
    });
    expect(result).toEqual(mocks.accountApi);
    expect(result).not.toHaveProperty('ledgerBalance');
  });

  it('SHOULD propagate Forbidden (403) from the use case', async () => {
    mocks.createAccountUseCase.execute.mockRejectedValueOnce(new ForbiddenException());

    await expect(setup.create(mocks.userId, body as never, today)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('SHOULD fail with the lookup error AND not call the use case WHEN the owner resolution fails', async () => {
    mocks.financeAccessService.resolve.mockRejectedValueOnce(new Error('db down'));

    await expect(setup.create(mocks.userId, body as never, today)).rejects.toThrow('db down');
    expect(mocks.createAccountUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('SHOULD pass ownerIds to the use case AND map every account', async () => {
    const result = await setup.findAll(mocks.userId, ['a'], today);

    expect(mocks.getAccountsUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['a'],
      today,
    });
    expect(result).toEqual([mocks.accountApi]);
  });

  it('SHOULD return [] WHEN there is no account', async () => {
    mocks.getAccountsUseCase.execute.mockResolvedValueOnce([]);

    expect(await setup.findAll(mocks.userId, undefined, today)).toEqual([]);
  });
});

describe('update', () => {
  it('SHOULD forward the id and the patch', async () => {
    const result = await setup.update(mocks.userId, mocks.accountApi.id, { name: 'New' }, today);

    expect(mocks.updateAccountUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.accountApi.id,
      name: 'New',
      today,
      userId: mocks.userId,
    });
    expect(result).toEqual(mocks.accountApi);
  });

  it('SHOULD propagate NotFound (404)', async () => {
    mocks.updateAccountUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.update(mocks.userId, 'x', { name: 'a' }, today)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('delete', () => {
  it('SHOULD call the use case with the accessible owners', async () => {
    await setup.delete(mocks.userId, mocks.accountApi.id);

    expect(mocks.deleteAccountUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.accountApi.id,
    });
  });
});

describe('adjustBalance', () => {
  it('SHOULD resolve the access, call the use case with the target and today AND return the API shape', async () => {
    const result = await setup.adjustBalance(mocks.userId, 'account-id', 120000, '2026-10-15');

    expect(mocks.adjustAccountBalanceUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      balance: 120000,
      id: 'account-id',
      today: '2026-10-15',
    });
    expect(result).toEqual(mocks.accountApi);
    expect(result).not.toHaveProperty('ledgerBalance');
  });
});

describe('getDailyBalances (spec 035)', () => {
  it('SHOULD materialize BEFORE reading AND map the accounts without balances', async () => {
    const order: string[] = [];
    mocks.materializeRecurrencesUseCase.execute.mockImplementationOnce(async () => {
      order.push('materialize');
    });
    mocks.getDailyBalancesUseCase.execute.mockImplementationOnce(async () => {
      order.push('read');

      return mocks.dailyResult;
    });

    const result = await setup.getDailyBalances(mocks.userId, ['a'], '2026-11', '2026-10-20');

    expect(order).toEqual(['materialize', 'read']);
    expect(mocks.materializeRecurrencesUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['a'],
      today: '2026-10-20',
    });
    expect(mocks.getDailyBalancesUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      month: '2026-11',
      ownerIds: ['a'],
      today: '2026-10-20',
    });
    expect(result.days).toEqual(mocks.dailyResult.days);
    expect(result.accounts).toEqual([
      {
        icon: 'bank',
        id: mocks.dailyResult.accounts[0].id,
        name: 'Checking',
        owner: 'USER',
        ownerId: mocks.userId,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('ledgerBalance');
  });
});

describe('favorite account (spec 094)', () => {
  it('SHOULD mark ONLY the favorite account of the requesting user WHEN listing, with ONE favorite read', async () => {
    const other = { ...mocks.accountApi, id: 'other-id' };
    mocks.getAccountFavoriteUseCase.execute.mockResolvedValue(mocks.accountApi.id);
    mocks.getAccountsUseCase.execute.mockResolvedValueOnce([
      {
        account: {
          ...mocks.accountApi,
          createdAt: new Date(),
          ledgerBalance: 1,
          updatedAt: new Date(),
        },
        balance: 150000,
        projectedBalance: 152075,
      },
      {
        account: { ...other, createdAt: new Date(), ledgerBalance: 1, updatedAt: new Date() },
        balance: 1,
        projectedBalance: 1,
      },
    ]);

    const result = await setup.findAll(mocks.userId, undefined, today);

    expect(result.map((item) => item.isFavorite)).toEqual([true, false]);
    expect(mocks.getAccountFavoriteUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mocks.getAccountFavoriteUseCase.execute).toHaveBeenCalledWith({ userId: mocks.userId });
  });

  it('SHOULD forward isFavorite AND the user id on create and update', async () => {
    await setup.create(mocks.userId, { ...body, isFavorite: true } as never, today);
    await setup.update(mocks.userId, 'id-1', { isFavorite: true }, today);

    expect(mocks.createAccountUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ isFavorite: true, userId: mocks.userId }),
    );
    expect(mocks.updateAccountUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id-1', isFavorite: true, userId: mocks.userId }),
    );
  });

  it('SHOULD report isFavorite on the result of a balance adjustment', async () => {
    mocks.getAccountFavoriteUseCase.execute.mockResolvedValue(mocks.accountApi.id);

    const result = await setup.adjustBalance(mocks.userId, 'account-id', 1, today);

    expect(result.isFavorite).toBe(true);
  });
});
