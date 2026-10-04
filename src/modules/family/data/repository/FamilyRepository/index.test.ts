import { mocks, setup, spies } from './index.mocks';

describe('createFamily', () => {
  it('SHOULD map the params to the datasource AND return the entity', async () => {
    const result = await setup.createFamily({
      name: 'Example Family',
      ownerEmail: 'test@example.com',
      ownerId: mocks.familyEntity.ownerId,
    });

    expect(spies.familyDatasource.create).toHaveBeenCalledWith({
      email: 'test@example.com',
      name: 'Example Family',
      owner_id: mocks.familyEntity.ownerId,
    });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.familyPersistence);
    expect(result).toEqual(mocks.familyEntity);
  });
});

describe('deleteFamily', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.deleteFamily(mocks.familyEntity.id);

    expect(spies.familyDatasource.delete).toHaveBeenCalledWith(mocks.familyEntity.id);
  });
});

describe('getFamilies', () => {
  it('SHOULD return the mapped families of the user', async () => {
    const result = await setup.getFamilies('user-id-123');

    expect(spies.familyDatasource.findByUserId).toHaveBeenCalledWith('user-id-123');
    expect(result).toEqual([mocks.familyEntity]);
  });

  it('SHOULD return an empty array WHEN the user has no family', async () => {
    spies.familyDatasource.findByUserId.mockResolvedValueOnce([]);

    expect(await setup.getFamilies('user-id-123')).toEqual([]);
  });
});

describe('getFamilyById', () => {
  it('SHOULD return the entity WHEN found', async () => {
    expect(await setup.getFamilyById(mocks.familyEntity.id)).toEqual(mocks.familyEntity);
  });

  it('SHOULD return undefined WHEN NOT found', async () => {
    spies.familyDatasource.findById.mockResolvedValueOnce(null);

    expect(await setup.getFamilyById(mocks.familyEntity.id)).toBeUndefined();
    expect(spies.mapper.toDomain).not.toHaveBeenCalled();
  });
});

describe('isFamilyMember', () => {
  it('SHOULD delegate to the datasource', async () => {
    const params = { familyId: mocks.familyEntity.id, userId: 'user-id-123' };

    expect(await setup.isFamilyMember(params)).toBe(true);
    expect(spies.familyDatasource.isMember).toHaveBeenCalledWith(params);
  });
});

describe('updateFamily', () => {
  it('SHOULD update AND return the mapped entity', async () => {
    const result = await setup.updateFamily({ id: mocks.familyEntity.id, name: 'Renamed' });

    expect(spies.familyDatasource.update).toHaveBeenCalledWith({
      id: mocks.familyEntity.id,
      name: 'Renamed',
    });
    expect(result).toEqual(mocks.familyEntity);
  });
});
