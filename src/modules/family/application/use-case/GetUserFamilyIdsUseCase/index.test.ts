import { mocks, setup } from './index.mocks';

it('SHOULD return the ids of the families the user belongs to', async () => {
  const result = await setup.execute(mocks.userId);

  expect(mocks.familyRepository.getFamilies).toHaveBeenCalledWith(mocks.userId);
  expect(result).toEqual(mocks.families.map((family) => family.id));
});

it('SHOULD return an empty array WHEN the user belongs to no family', async () => {
  mocks.familyRepository.getFamilies.mockResolvedValueOnce([]);

  expect(await setup.execute(mocks.userId)).toEqual([]);
});
