import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD delete everything of the user WHEN the owner is the account', async () => {
  expect(await setup.execute({ owner: OwnerType.USER, ownerId: 'user-1' })).toBe(4);
  expect(mocks.notificationRepository.deleteByUser).toHaveBeenCalledWith('user-1');
});

it('SHOULD drop the items of the family for everyone WHEN the owner is a family', async () => {
  expect(await setup.execute({ owner: OwnerType.FAMILY, ownerId: 'f1' })).toBe(0);
  expect(mocks.notificationRepository.removeFamilyItemsForAll).toHaveBeenCalledWith('f1');
  expect(mocks.notificationRepository.deleteByUser).not.toHaveBeenCalled();
});
