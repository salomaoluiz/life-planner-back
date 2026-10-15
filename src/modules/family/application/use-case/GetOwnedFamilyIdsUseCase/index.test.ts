import { mocks, setup } from './index.mocks';

it('SHOULD return the ids of the families the user owns', async () => {
  mocks.familyRepository.getOwnedFamilyIds.mockResolvedValueOnce(['family-1', 'family-2']);

  expect(await setup.execute(mocks.userId)).toEqual(['family-1', 'family-2']);
  expect(mocks.familyRepository.getOwnedFamilyIds).toHaveBeenCalledWith(mocks.userId);
});

it('SHOULD return an empty array WHEN the user owns no family (only joined some)', async () => {
  mocks.familyRepository.getOwnedFamilyIds.mockResolvedValueOnce([]);

  expect(await setup.execute(mocks.userId)).toEqual([]);
});
