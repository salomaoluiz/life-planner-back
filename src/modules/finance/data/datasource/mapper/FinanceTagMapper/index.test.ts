import { FinanceTagMapper } from './index';
import { mocks } from './index.mocks';

describe('FinanceTagMapper.toDomain', () => {
  it('SHOULD map a single-scope tag to its owner scope AND the usage count', () => {
    expect(FinanceTagMapper.toDomain(mocks.rawSingle, 4)).toEqual({
      allScopes: false,
      createdAt: mocks.rawSingle.created_at,
      creatorId: mocks.rawSingle.creator_id,
      id: mocks.rawSingle.id,
      name: 'gasto-fixo',
      owner: 'FAMILY',
      ownerId: mocks.rawSingle.owner_id,
      scopes: [{ owner: 'FAMILY', ownerId: mocks.rawSingle.owner_id }],
      updatedAt: mocks.rawSingle.updated_at,
      usageCount: 4,
    });
  });

  it('SHOULD map an ALL tag to every scope row AND default the usage to 0', () => {
    const entity = FinanceTagMapper.toDomain(mocks.rawAll);

    expect(entity.allScopes).toBe(true);
    expect(entity.scopes).toEqual([
      { owner: 'USER', ownerId: mocks.rawAll.owner_id },
      { owner: 'FAMILY', ownerId: 'family-1' },
    ]);
    expect(entity.usageCount).toBe(0);
  });
});
