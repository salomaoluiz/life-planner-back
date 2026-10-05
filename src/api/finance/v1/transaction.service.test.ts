import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { TransactionType } from '@finance/domain/enum';

import { mocks, setup } from './transaction.service.mocks';

describe('create', () => {
  it('SHOULD add the accessible owners AND return the API shape with embedded summaries and ISO dates', async () => {
    const body = {
      accountId: mocks.transactionApi.accountId,
      categoryId: mocks.transactionApi.categoryId,
      date: '2026-10-03',
      description: 'Weekly groceries',
      owner: OwnerType.USER,
      ownerId: mocks.userId,
      type: TransactionType.EXPENSE,
      value: 23490,
    };

    const result = await setup.create(mocks.userId, body);

    expect(mocks.createTransactionUseCase.execute).toHaveBeenCalledWith({
      ...body,
      accessibleOwners: mocks.accessibleOwners,
    });
    expect(result).toEqual(mocks.transactionApi);
    expect(result.account).toEqual({
      icon: 'bank',
      id: mocks.transactionApi.account.id,
      name: 'Checking',
    });
    expect(result.category.iconColor).toBe('#2E7D32');
    expect(result.date).toBe('2026-10-03');
  });
});

describe('findAll', () => {
  it('SHOULD forward ownerIds AND map every transaction', async () => {
    const result = await setup.findAll(mocks.userId, ['o1']);

    expect(mocks.getTransactionsUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['o1'],
    });
    expect(result).toEqual([mocks.transactionApi]);
  });
});

describe('update', () => {
  it('SHOULD forward the id and the patch', async () => {
    await setup.update(mocks.userId, 'tx-1', { value: 100 });

    expect(mocks.updateTransactionUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'tx-1',
      value: 100,
    });
  });
});

describe('delete', () => {
  it('SHOULD call the use case with the accessible owners', async () => {
    await setup.delete(mocks.userId, 'tx-1');

    expect(mocks.deleteTransactionUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'tx-1',
    });
  });
});
