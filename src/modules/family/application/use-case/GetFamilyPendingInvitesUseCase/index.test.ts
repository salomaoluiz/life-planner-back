import { mocks, setup } from './index.mocks';

it('SHOULD return only the members that have not joined yet', async () => {
  const result = await setup.execute({ familyId: 'family-1' });

  expect(mocks.familyMemberRepository.findByFamilyId).toHaveBeenCalledWith('family-1');
  expect(result).toEqual([{ email: 'test@example.com', id: 'pending' }]);
});

it('SHOULD return an empty list WHEN everyone joined', async () => {
  mocks.familyMemberRepository.findByFamilyId.mockResolvedValueOnce([]);

  expect(await setup.execute({ familyId: 'family-1' })).toEqual([]);
});
