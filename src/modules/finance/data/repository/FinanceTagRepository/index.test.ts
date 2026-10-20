import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

const family = { owner: OwnerType.FAMILY, ownerId: 'family' };

describe('createTag', () => {
  it('SHOULD translate to snake_case columns AND map the result', async () => {
    const result = await setup.createTag({
      allScopes: true,
      creatorId: 'creator',
      name: 'gasto-fixo',
      owner: OwnerType.USER,
      ownerId: 'creator',
      scopes: [family],
    });

    expect(mocks.tagDatasource.create).toHaveBeenCalledWith({
      all_scopes: true,
      creator_id: 'creator',
      name: 'gasto-fixo',
      owner: 'USER',
      owner_id: 'creator',
      scopes: [{ owner: 'FAMILY', owner_id: 'family' }],
    });
    expect(result).toBe(mocks.tagEntity);
  });
});

describe('findTags', () => {
  it('SHOULD map every row with its usage count (0 WHEN unused)', async () => {
    mocks.tagDatasource.countUsage.mockResolvedValueOnce(new Map());

    await setup.findTags({ owners: [family], q: 'gas' });

    expect(mocks.tagDatasource.findByOwners).toHaveBeenCalledWith({ owners: [family], q: 'gas' });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.tagPersistence, 0);

    await setup.findTags({ owners: [family] });

    expect(spies.mapper.toDomain).toHaveBeenLastCalledWith(mocks.tagPersistence, 5);
  });
});

describe('findTagById', () => {
  it('SHOULD map the row, or return undefined WHEN not found', async () => {
    expect(await setup.findTagById('id-1')).toBe(mocks.tagEntity);

    mocks.tagDatasource.findById.mockResolvedValueOnce(null);

    expect(await setup.findTagById('id-2')).toBeUndefined();
  });
});

describe('findConflictingScopes', () => {
  it('SHOULD return only the requested scopes the conflicting tags belong to', async () => {
    const other = { owner: OwnerType.FAMILY, ownerId: 'other' };

    const result = await setup.findConflictingScopes({
      excludeId: 'x',
      name: 'Gasto',
      scopes: [mocks.tagEntity.scopes[0], other],
    });

    expect(mocks.tagDatasource.findConflicts).toHaveBeenCalledWith({
      exclude_id: 'x',
      name: 'Gasto',
      scopes: [mocks.tagEntity.scopes[0], other],
    });
    expect(result).toEqual([mocks.tagEntity.scopes[0]]);
  });
});

describe('updateTag', () => {
  it('SHOULD translate the rename AND the switch to ALL', async () => {
    await setup.updateTag({
      id: 'id-1',
      name: 'novo',
      scope: { creatorId: 'creator', scopes: [family] },
    });

    expect(mocks.tagDatasource.update).toHaveBeenCalledWith({
      id: 'id-1',
      name: 'novo',
      scope: { creator_id: 'creator', scopes: [{ owner: 'FAMILY', owner_id: 'family' }] },
    });
  });
});

describe('scope methods and delete/exists', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.addScope({ creatorId: 'creator', owner: family });
    await setup.removeScope(family);
    await setup.deleteTag('id-1');

    expect(mocks.tagDatasource.addScope).toHaveBeenCalledWith({
      creator_id: 'creator',
      owner: 'FAMILY',
      owner_id: 'family',
    });
    expect(mocks.tagDatasource.removeScope).toHaveBeenCalledWith({
      owner: 'FAMILY',
      owner_id: 'family',
    });
    expect(mocks.tagDatasource.delete).toHaveBeenCalledWith('id-1');
    expect(await setup.detachFamilyScope({ creatorId: 'creator', familyId: 'family' })).toBe(2);
    expect(await setup.existsByOwner(family)).toBe(true);
  });
});
