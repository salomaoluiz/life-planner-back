import { mocks, setup } from './index.mocks';

it('SHOULD return every family of the user with its archived flag', async () => {
  const result = await setup.execute(mocks.userId);

  expect(mocks.familyRepository.getFamilies).toHaveBeenCalledWith(mocks.userId);
  expect(result).toEqual([
    { archived: false, familyId: mocks.families[0].id },
    { archived: true, familyId: mocks.families[1].id },
  ]);
});

it('SHOULD return an empty array WHEN the user belongs to no family', async () => {
  mocks.familyRepository.getFamilies.mockResolvedValueOnce([]);

  expect(await setup.execute(mocks.userId)).toEqual([]);
});
