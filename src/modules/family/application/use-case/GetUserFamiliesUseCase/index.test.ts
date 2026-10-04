import { mocks, setup } from './index.mocks';

it('SHOULD sort by name case-insensitively, then by createdAt ascending', async () => {
  const result = await setup.execute({ userId: mocks.userId });

  expect(mocks.familyRepository.getFamilies).toHaveBeenCalledWith(mocks.userId);
  expect(result.map((family) => family.id)).toEqual(mocks.expectedOrderIds);
});

it('SHOULD return an empty array WHEN the user belongs to no family', async () => {
  mocks.familyRepository.getFamilies.mockResolvedValueOnce([]);

  expect(await setup.execute({ userId: mocks.userId })).toEqual([]);
});
