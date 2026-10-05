import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './category.service.mocks';

describe('create', () => {
  it('SHOULD add the accessible owners AND map root parentId undefined to null', async () => {
    const body = {
      icon: 'cart',
      iconColor: '#2E7D32',
      name: 'Groceries',
      owner: OwnerType.USER,
      ownerId: mocks.userId,
      type: TransactionType.EXPENSE,
    };

    const result = await setup.create(mocks.userId, body);

    expect(mocks.createCategoryUseCase.execute).toHaveBeenCalledWith({
      ...body,
      accessibleOwners: mocks.accessibleOwners,
    });
    expect(result).toEqual(mocks.rootApi);
  });
});

describe('findAll', () => {
  it('SHOULD forward ownerIds and type AND map a child parentId', async () => {
    mocks.getCategoriesUseCase.execute.mockResolvedValueOnce([mocks.childResult]);

    const result = await setup.findAll(mocks.userId, ['o1'], TransactionType.EXPENSE);

    expect(mocks.getCategoriesUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['o1'],
      type: TransactionType.EXPENSE,
    });
    expect(result[0].parentId).toBe(mocks.childResult.parentId);
    expect(result[0].depthLevel).toBe(1);
  });
});

describe('update', () => {
  it('SHOULD forward the id and the patch (parentId null = make root)', async () => {
    await setup.update(mocks.userId, 'cat-1', { parentId: null });

    expect(mocks.updateCategoryUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'cat-1',
      parentId: null,
    });
  });
});

describe('delete', () => {
  it('SHOULD call the use case with the accessible owners', async () => {
    await setup.delete(mocks.userId, 'cat-1');

    expect(mocks.deleteCategoryUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'cat-1',
    });
  });
});
