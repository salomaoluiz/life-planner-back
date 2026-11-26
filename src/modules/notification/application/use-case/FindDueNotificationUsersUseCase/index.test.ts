import { defaultPreferences } from '@notification/domain/entity/NotificationPreferences';

import { mocks, setup } from './index.mocks';

const now = new Date('2026-11-23T11:30:00Z'); // 08:30 in São Paulo
const due = defaultPreferences('user-due');
const urgent = { ...defaultPreferences('user-urgent'), lastSummaryOn: '2026-11-23' };
const done = {
  ...defaultPreferences('user-late'),
  lastSummaryOn: '2026-11-22',
  summaryMinute: 600,
};

it('SHOULD keep users due for the summary or for urgent notices AND drop the rest', async () => {
  mocks.notificationPreferenceRepository.findDueUsers.mockResolvedValue([due, urgent, done]);

  const result = await setup.execute({ limit: 200, now });

  expect(
    result.users.map((user) => [user.preferences.userId, user.summaryDue, user.urgentDue]),
  ).toEqual([
    ['user-due', true, false],
    ['user-urgent', false, true],
  ]);
});

it("SHOULD attach each user's turned-off families", async () => {
  mocks.notificationPreferenceRepository.findDueUsers.mockResolvedValue([due]);
  mocks.notificationPreferenceRepository.findDisabledFamilyIds.mockResolvedValue(
    new Map([['user-due', new Set(['f1'])]]),
  );

  const result = await setup.execute({ limit: 200, now });

  expect([...result.users[0].disabledFamilyIds]).toEqual(['f1']);
  expect(mocks.notificationPreferenceRepository.findDisabledFamilyIds).toHaveBeenCalledWith([
    'user-due',
  ]);
});

it('SHOULD report a full page with the last user id to continue from', async () => {
  mocks.notificationPreferenceRepository.findDueUsers.mockResolvedValue([due, urgent]);

  expect(await setup.execute({ afterUserId: 'a', limit: 2, now })).toEqual(
    expect.objectContaining({ hasMore: true, lastUserId: 'user-urgent' }),
  );
  expect(mocks.notificationPreferenceRepository.findDueUsers).toHaveBeenCalledWith(now, 'a', 2);
});

it('SHOULD report the end WHEN the page is not full', async () => {
  expect(await setup.execute({ limit: 200, now })).toEqual({
    hasMore: false,
    lastUserId: undefined,
    users: [],
  });
});
