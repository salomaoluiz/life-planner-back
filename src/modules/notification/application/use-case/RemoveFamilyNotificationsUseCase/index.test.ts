import { mocks, setup } from './index.mocks';

it('SHOULD drop the family items and the family switch of the member who left', async () => {
  await setup.execute({ familyId: 'f1', userId: 'user-1' });

  expect(mocks.notificationRepository.removeFamilyItems).toHaveBeenCalledWith('user-1', 'f1');
  expect(mocks.notificationPreferenceRepository.removeFamily).toHaveBeenCalledWith('user-1', 'f1');
  expect(mocks.notificationRepository.removeFamilyItemsForAll).not.toHaveBeenCalled();
});

it('SHOULD drop the family items of every member WHEN the family was deleted', async () => {
  await setup.execute({ familyId: 'f1' });

  expect(mocks.notificationRepository.removeFamilyItemsForAll).toHaveBeenCalledWith('f1');
  expect(mocks.notificationRepository.removeFamilyItems).not.toHaveBeenCalled();
});
