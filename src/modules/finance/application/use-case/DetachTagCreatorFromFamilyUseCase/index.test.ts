import { mocks, setup } from './index.mocks';

describe('DetachTagCreatorFromFamilyUseCase', () => {
  it('SHOULD copy the ALL tags for the family AND return how many', async () => {
    expect(await setup.execute({ familyId: 'family-1', userId: 'user-1' })).toBe(2);
    expect(mocks.tagRepository.detachFamilyScope).toHaveBeenCalledWith({
      creatorId: 'user-1',
      familyId: 'family-1',
    });
  });
});
