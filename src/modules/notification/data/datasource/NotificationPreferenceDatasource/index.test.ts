import { Database } from '@shared/infra/db/Database';

import { NotificationPreferenceDatasource } from './index';

const client = {
  $queryRaw: jest.fn(),
  notificationFamilyPreference: { deleteMany: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
  notificationPreference: { findUnique: jest.fn(), upsert: jest.fn() },
};
const setup = new NotificationPreferenceDatasource({ client } as unknown as Database);

beforeEach(() => jest.clearAllMocks());

it('SHOULD read the due users with one statement carrying now, the cursor and the limit', async () => {
  client.$queryRaw.mockResolvedValue([{ user_id: 'u' }]);

  expect(await setup.findDue(new Date('2026-11-23T11:00:00Z'), undefined, 200)).toEqual([
    { user_id: 'u' },
  ]);
  expect(client.$queryRaw).toHaveBeenCalledTimes(1);
  const [query] = client.$queryRaw.mock.calls[0];

  expect(query.values).toEqual(expect.arrayContaining([200]));
  expect(query.sql).toContain('"last_summary_on"');
});

it('SHOULD not query WHEN there are no users for the family switches', async () => {
  expect(await setup.findDisabledFamilies([])).toEqual([]);
  expect(client.notificationFamilyPreference.findMany).not.toHaveBeenCalled();
});

it('SHOULD read only the families turned off', async () => {
  client.notificationFamilyPreference.findMany.mockResolvedValue([]);

  await setup.findDisabledFamilies(['u']);

  expect(client.notificationFamilyPreference.findMany).toHaveBeenCalledWith({
    select: { family_id: true, user_id: true },
    where: { enabled: false, user_id: { in: ['u'] } },
  });
});

it('SHOULD upsert preferences, the family switch AND the last summary date', async () => {
  await setup.upsert('u', { bill_lead_days: 5 });
  await setup.setFamily('u', 'f', false);
  await setup.setLastSummaryOn('u', '2026-11-23');
  await setup.deleteFamily('u', 'f');
  await setup.find('u');

  expect(client.notificationPreference.upsert).toHaveBeenNthCalledWith(1, {
    create: { bill_lead_days: 5, user_id: 'u' },
    update: { bill_lead_days: 5 },
    where: { user_id: 'u' },
  });
  expect(client.notificationFamilyPreference.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ create: { enabled: false, family_id: 'f', user_id: 'u' } }),
  );
  expect(client.notificationPreference.upsert).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ update: { last_summary_on: new Date('2026-11-23T00:00:00.000Z') } }),
  );
  expect(client.notificationFamilyPreference.deleteMany).toHaveBeenCalledWith({
    where: { family_id: 'f', user_id: 'u' },
  });
  expect(client.notificationPreference.findUnique).toHaveBeenCalledWith({
    where: { user_id: 'u' },
  });
});
