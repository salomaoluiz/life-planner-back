import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { defaultPreferences } from '@notification/domain/entity/NotificationPreferences';

import { mocks, setup } from './index.mocks';

const preferences = defaultPreferences('user-1');
const now = new Date('2026-11-23T11:00:00Z'); // 08:00 in São Paulo
const item: NotificationItemInput = {
  dueDate: '2026-11-23',
  module: 'STOCK',
  owner: 'USER' as never,
  ownerId: 'user-1',
  route: '/stock/items/i',
  snapshot: { description: 'Iogurte natural' },
  sourceId: 'lot-1',
  state: 'DUE_TODAY',
  type: 'STOCK_EXPIRING',
};

it('SHOULD create ONE summary with the local date, the composed text AND mark the summary done', async () => {
  await setup.execute({ items: [item], now, preferences });

  expect(mocks.notificationRepository.create).toHaveBeenCalledTimes(1);
  expect(mocks.notificationRepository.create).toHaveBeenCalledWith(
    expect.objectContaining({
      body: 'Iogurte natural',
      kind: 'SUMMARY',
      localDate: '2026-11-23',
      pushAt: now,
      title: 'Hoje: 1 avisos',
      userId: 'user-1',
    }),
    true,
  );
  expect(mocks.notificationPreferenceRepository.setLastSummaryOn).not.toHaveBeenCalled();
});

it('SHOULD create nothing BUT still set lastSummaryOn WHEN there are no items (FR 11)', async () => {
  expect(await setup.execute({ items: [], now, preferences })).toBeNull();

  expect(mocks.notificationRepository.create).not.toHaveBeenCalled();
  expect(mocks.notificationPreferenceRepository.setLastSummaryOn).toHaveBeenCalledWith(
    'user-1',
    '2026-11-23',
  );
});

it("SHOULD use the user's time zone for the local date", async () => {
  await setup.execute({
    items: [item],
    now: new Date('2026-11-24T02:30:00Z'),
    preferences: { ...preferences, timeZone: 'America/Sao_Paulo' },
  });

  expect(mocks.notificationRepository.create).toHaveBeenCalledWith(
    expect.objectContaining({ localDate: '2026-11-23' }),
    true,
  );
});
