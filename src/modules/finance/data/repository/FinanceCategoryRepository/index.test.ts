import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

describe('createCategory', () => {
  it('SHOULD translate to snake_case columns (no parent_id for a root) AND map the result', async () => {
    const result = await setup.createCategory({
      depthLevel: 0,
      icon: 'cart',
      iconColor: '#000000',
      name: 'Groceries',
      owner: OwnerType.USER,
      ownerId: 'owner-id',
      type: TransactionType.EXPENSE,
    });

    expect(mocks.categoryDatasource.create).toHaveBeenCalledWith({
      depth_level: 0,
      icon: 'cart',
      icon_color: '#000000',
      name: 'Groceries',
      owner: 'USER',
      owner_id: 'owner-id',
      parent_id: undefined,
      type: 'EXPENSE',
    });
    expect(result).toBe(mocks.categoryEntity);
  });
});

describe('deleteCategory / existsByOwner', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.deleteCategory('id-1');
    const exists = await setup.existsByOwner({ owner: OwnerType.FAMILY, ownerId: 'fam' });

    expect(mocks.categoryDatasource.delete).toHaveBeenCalledWith('id-1');
    expect(mocks.categoryDatasource.exists).toHaveBeenCalledWith({
      owner: 'FAMILY',
      owner_id: 'fam',
    });
    expect(exists).toBe(true);
  });
});

describe('findCategories', () => {
  it('SHOULD forward owners and type AND map every row', async () => {
    const owners = [{ owner: OwnerType.USER, ownerId: 'u' }];

    const result = await setup.findCategories({ owners, type: TransactionType.INCOME });

    expect(mocks.categoryDatasource.findByOwners).toHaveBeenCalledWith({ owners, type: 'INCOME' });
    expect(result).toEqual([mocks.categoryEntity]);
  });
});

describe('findCategoryById', () => {
  it('SHOULD map the row, or return undefined WHEN not found', async () => {
    expect(await setup.findCategoryById('id-1')).toBe(mocks.categoryEntity);

    mocks.categoryDatasource.findById.mockResolvedValueOnce(null);
    spies.mapper.toDomain.mockClear();

    expect(await setup.findCategoryById('id-1')).toBeUndefined();
    expect(spies.mapper.toDomain).not.toHaveBeenCalled();
  });
});

describe('updateCategory', () => {
  it('SHOULD translate to columns, keep null (root) distinct from undefined AND map subtree depths', async () => {
    const result = await setup.updateCategory({
      depthLevel: 0,
      id: 'id-1',
      parentId: null,
      subtreeDepths: [{ depthLevel: 1, id: 'child' }],
    });

    expect(mocks.categoryDatasource.update).toHaveBeenCalledWith({
      depth_level: 0,
      icon: undefined,
      icon_color: undefined,
      id: 'id-1',
      name: undefined,
      parent_id: null,
      subtree_depths: [{ depth_level: 1, id: 'child' }],
      type: undefined,
    });
    expect(result).toBe(mocks.categoryEntity);
  });
});
