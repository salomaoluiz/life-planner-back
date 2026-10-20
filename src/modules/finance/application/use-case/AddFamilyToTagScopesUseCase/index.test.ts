import { mocks, setup } from './index.mocks';

describe('AddFamilyToTagScopesUseCase', () => {
  it('SHOULD add the family scope to the ALL tags of the creator', async () => {
    await setup.execute({ familyId: 'family-1', userId: 'user-1' });

    expect(mocks.tagRepository.addScope).toHaveBeenCalledWith({
      creatorId: 'user-1',
      owner: { owner: 'FAMILY', ownerId: 'family-1' },
    });
  });

  it('SHOULD reject a missing id', async () => {
    await expect(setup.execute({ familyId: '', userId: 'user-1' })).rejects.toThrow();
  });
});
