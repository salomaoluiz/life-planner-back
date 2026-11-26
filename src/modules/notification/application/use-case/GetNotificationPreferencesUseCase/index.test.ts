import { defaultPreferences } from '@notification/domain/entity/NotificationPreferences';

import { mocks, setup } from './index.mocks';

it('SHOULD return the preferences with the families turned off', async () => {
  const preferences = defaultPreferences('user-1');
  mocks.notificationPreferenceRepository.find.mockResolvedValue(preferences);
  mocks.notificationPreferenceRepository.findDisabledFamilyIds.mockResolvedValue(
    new Map([['user-1', new Set(['family-1'])]]),
  );

  expect(await setup.execute({ userId: 'user-1' })).toEqual({
    disabledFamilyIds: ['family-1'],
    preferences,
  });
});

it('SHOULD return no disabled family WHEN the user turned none off', async () => {
  mocks.notificationPreferenceRepository.find.mockResolvedValue(defaultPreferences('user-1'));

  expect((await setup.execute({ userId: 'user-1' })).disabledFamilyIds).toEqual([]);
});
