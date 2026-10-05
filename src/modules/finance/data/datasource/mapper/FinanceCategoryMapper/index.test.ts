import { FinanceCategoryMapper } from './index';
import { mocks } from './index.mocks';

describe('FinanceCategoryMapper.toDomain', () => {
  it('SHOULD map every column of a child category', () => {
    expect(FinanceCategoryMapper.toDomain(mocks.rawChild)).toEqual({
      createdAt: mocks.rawChild.created_at,
      depthLevel: 1,
      icon: 'store',
      iconColor: '#2E7D32',
      id: mocks.rawChild.id,
      name: 'Supermarket',
      owner: 'FAMILY',
      ownerId: mocks.rawChild.owner_id,
      parentId: mocks.rawChild.parent_id,
      type: 'INCOME',
      updatedAt: mocks.rawChild.updated_at,
    });
  });

  it('SHOULD map a NULL parent_id to an undefined parentId', () => {
    expect(FinanceCategoryMapper.toDomain(mocks.rawRoot).parentId).toBeUndefined();
  });
});
