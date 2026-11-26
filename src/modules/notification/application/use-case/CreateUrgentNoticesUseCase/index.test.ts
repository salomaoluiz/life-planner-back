import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { defaultPreferences } from '@notification/domain/entity/NotificationPreferences';

import { mocks, setup } from './index.mocks';

const preferences = defaultPreferences('user-1');
function item(
  sourceId: string,
  overrides: Partial<NotificationItemInput> = {},
): NotificationItemInput {
  return {
    dueDate: '2026-11-23',
    module: 'FINANCE',
    owner: 'USER' as never,
    ownerId: 'user-1',
    route: `/finance/transactions/${sourceId}`,
    snapshot: { accountName: 'Conta corrente', description: 'Luz', valueCents: 21430 },
    sourceId,
    state: 'DUE_TODAY',
    type: 'FINANCE_BILL_DUE',
    ...overrides,
  };
}
const afternoon = new Date('2026-11-23T17:05:00Z'); // 14:05 in São Paulo

it('SHOULD create one URGENT notice per new DUE_TODAY item AND push it now, outside quiet hours', async () => {
  expect(
    await setup.execute({ candidates: [item('a'), item('b')], now: afternoon, preferences }),
  ).toBe(2);

  expect(mocks.notificationRepository.create).toHaveBeenCalledTimes(2);
  expect(mocks.notificationRepository.create).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'URGENT',
      localDate: '2026-11-23',
      pushAt: afternoon,
      title: 'Conta vence hoje: Luz',
    }),
    false,
  );
});

it('SHOULD skip items already in a notice of the day (summary or urgent)', async () => {
  mocks.notificationRepository.findKeys.mockResolvedValue(
    new Set(['FINANCE_BILL_DUE:a:2026-11-23']),
  );

  expect(
    await setup.execute({ candidates: [item('a'), item('b')], now: afternoon, preferences }),
  ).toBe(1);
  expect(mocks.notificationRepository.findKeys).toHaveBeenCalledWith('user-1', '2026-11-23');
});

it('SHOULD ignore items that are not due today WITHOUT reading the keys', async () => {
  expect(
    await setup.execute({
      candidates: [item('a', { state: 'UPCOMING' })],
      now: afternoon,
      preferences,
    }),
  ).toBe(0);
  expect(mocks.notificationRepository.findKeys).not.toHaveBeenCalled();
});

it('SHOULD create at once but hold the push until 07:00 WHEN found at 23:00 in quiet hours', async () => {
  const night = new Date('2026-11-24T02:00:00Z'); // 23:00 in São Paulo

  await setup.execute({
    candidates: [item('a', { dueDate: '2026-11-23' })],
    now: night,
    preferences,
  });

  expect(mocks.notificationRepository.create).toHaveBeenCalledWith(
    expect.objectContaining({ pushAt: new Date('2026-11-24T10:00:00.000Z') }),
    false,
  );
});
