import { mocks, setup } from './tag.service.mocks';

describe('create', () => {
  it('SHOULD add the accessible owners AND the caller, then map the tag', async () => {
    const result = await setup.create(mocks.userId, { name: 'gasto-fixo', owner: 'ALL' });

    expect(mocks.createTagUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      callerId: mocks.userId,
      name: 'gasto-fixo',
      owner: 'ALL',
    });
    expect(result).toEqual({
      createdAt: mocks.singleTag.createdAt.toISOString(),
      id: mocks.singleTag.id,
      name: mocks.singleTag.name,
      owner: 'USER',
      ownerId: mocks.userId,
      scope: 'PERSONAL',
      scopes: [{ owner: 'USER', ownerId: mocks.userId }],
      updatedAt: mocks.singleTag.updatedAt.toISOString(),
      usageCount: 3,
    });
  });
});

describe('findAll', () => {
  it('SHOULD forward the filters AND list the Personal scope of an ALL tag first', async () => {
    mocks.getTagsUseCase.execute.mockResolvedValueOnce([mocks.allTag]);

    const [result] = await setup.findAll(mocks.userId, ['o1'], 'gas');

    expect(mocks.getTagsUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['o1'],
      q: 'gas',
    });
    expect(result.scope).toBe('ALL');
    expect(result.scopes[0]).toEqual({ owner: 'USER', ownerId: mocks.userId });
    expect(result.owner).toBe('USER');
  });

  it('SHOULD expose the first visible scope as owner WHEN the creator Personal scope is not reachable', async () => {
    const family = mocks.accessibleOwners[1];
    mocks.financeAccessService.resolve.mockResolvedValueOnce([family]);
    mocks.getTagsUseCase.execute.mockResolvedValueOnce([mocks.allTag]);

    const [result] = await setup.findAll('other-user');

    expect(result.scopes).toEqual([family]);
    expect(result.ownerId).toBe(family.ownerId);
  });
});

describe('update / delete', () => {
  it('SHOULD forward the id, the patch AND the caller', async () => {
    await setup.update(mocks.userId, 'tag-1', { scope: 'ALL' });

    expect(mocks.updateTagUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      callerId: mocks.userId,
      id: 'tag-1',
      scope: 'ALL',
    });

    await setup.delete(mocks.userId, 'tag-1');

    expect(mocks.deleteTagUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'tag-1',
    });
  });
});
