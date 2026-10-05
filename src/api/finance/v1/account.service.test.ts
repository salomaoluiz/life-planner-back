import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './account.service.mocks';

const body = {
  balance: 152075,
  icon: 'bank',
  name: 'Checking',
  owner: 'USER' as const,
  ownerId: mocks.userId,
  status: 'ACTIVE' as const,
};

describe('create', () => {
  it('SHOULD resolve the accessible owners, call the use case AND return the API shape (ISO dates)', async () => {
    const result = await setup.create(mocks.userId, body as never);

    expect(mocks.financeAccessService.resolve).toHaveBeenCalledWith(mocks.userId);
    expect(mocks.createAccountUseCase.execute).toHaveBeenCalledWith({
      ...body,
      accessibleOwners: mocks.accessibleOwners,
    });
    expect(result).toEqual(mocks.accountApi);
  });

  it('SHOULD propagate Forbidden (403) from the use case', async () => {
    mocks.createAccountUseCase.execute.mockRejectedValueOnce(new ForbiddenException());

    await expect(setup.create(mocks.userId, body as never)).rejects.toThrow(ForbiddenException);
  });

  it('SHOULD fail with the lookup error AND not call the use case WHEN the owner resolution fails', async () => {
    mocks.financeAccessService.resolve.mockRejectedValueOnce(new Error('db down'));

    await expect(setup.create(mocks.userId, body as never)).rejects.toThrow('db down');
    expect(mocks.createAccountUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('SHOULD pass ownerIds to the use case AND map every account', async () => {
    const result = await setup.findAll(mocks.userId, ['a']);

    expect(mocks.getAccountsUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['a'],
    });
    expect(result).toEqual([mocks.accountApi]);
  });

  it('SHOULD return [] WHEN there is no account', async () => {
    mocks.getAccountsUseCase.execute.mockResolvedValueOnce([]);

    expect(await setup.findAll(mocks.userId)).toEqual([]);
  });
});

describe('update', () => {
  it('SHOULD forward the id and the patch', async () => {
    const result = await setup.update(mocks.userId, mocks.accountApi.id, { name: 'New' });

    expect(mocks.updateAccountUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.accountApi.id,
      name: 'New',
    });
    expect(result).toEqual(mocks.accountApi);
  });

  it('SHOULD propagate NotFound (404)', async () => {
    mocks.updateAccountUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.update(mocks.userId, 'x', { name: 'a' })).rejects.toThrow(NotFoundException);
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
