import { mocks, setup } from './index.mocks';

it('SHOULD delegate the user reads and writes to the datasource', async () => {
  mocks.datasource.findByUser.mockResolvedValue('a1');

  expect(await setup.findByUser('u1')).toBe('a1');
  await setup.set('u1', 'a2');
  await setup.clear('u1', 'a2');
  await setup.clearByAccount('a2');

  expect(mocks.datasource.upsert).toHaveBeenCalledWith('u1', 'a2');
  expect(mocks.datasource.deleteForUser).toHaveBeenCalledWith('u1', 'a2');
  expect(mocks.datasource.deleteByAccount).toHaveBeenCalledWith('a2');
});

it('SHOULD map the family clear to snake_case params', async () => {
  await setup.clearByFamilyForUsers({ familyId: 'f1', userIds: ['u1'] });

  expect(mocks.datasource.deleteByFamily).toHaveBeenCalledWith({
    family_id: 'f1',
    user_ids: ['u1'],
  });
});
