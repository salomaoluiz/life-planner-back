import { mocks, setup } from './index.mocks';

describe('RemoveFamilyFromTagScopesUseCase', () => {
  it('SHOULD remove the family from every ALL tag scope', async () => {
    await setup.execute({ familyId: 'family-1' });

    expect(mocks.tagRepository.removeScope).toHaveBeenCalledWith({
      owner: 'FAMILY',
      ownerId: 'family-1',
    });
  });
});
