import { NotificationMapper } from './index';

const now = new Date('2026-11-23T11:00:00.000Z');
const itemRow = {
  dedupe_key: 'STOCK_EXPIRING:lot-1:2026-11-23',
  due_date: new Date('2026-11-23T00:00:00.000Z'),
  id: 'item-1',
  module: 'STOCK',
  notification_id: 'n-1',
  owner: 'FAMILY',
  owner_id: 'family-1',
  position: 0,
  route: '/stock/items/i',
  snapshot: { description: 'Iogurte' },
  source_id: 'lot-1',
  state: 'DUE_TODAY',
  type: 'STOCK_EXPIRING',
  user_id: 'user-1',
} as never;
function noticeRow(kind: 'SUMMARY' | 'URGENT', items = [itemRow]) {
  return {
    body: 'b',
    created_at: now,
    id: 'n-1',
    items,
    kind,
    local_date: new Date('2026-11-23T00:00:00.000Z'),
    read_at: null,
    title: 't',
    user_id: 'user-1',
  } as never;
}

it('SHOULD map a notice with its items and calendar dates', () => {
  expect(NotificationMapper.toNotification(noticeRow('SUMMARY'))).toEqual({
    body: 'b',
    createdAt: now,
    id: 'n-1',
    items: [
      expect.objectContaining({
        dedupeKey: 'STOCK_EXPIRING:lot-1:2026-11-23',
        dueDate: '2026-11-23',
        owner: 'FAMILY',
      }),
    ],
    kind: 'SUMMARY',
    localDate: '2026-11-23',
    readAt: null,
    title: 't',
    userId: 'user-1',
  });
});

it('SHOULD map the preferences, the date of the last summary AND a device', () => {
  const preferences = NotificationMapper.toPreferences({
    bill_lead_days: 3,
    disabled_types: ['FINANCE_INVOICE_DUE'],
    invoice_lead_days: 5,
    last_summary_on: new Date('2026-11-22T00:00:00.000Z'),
    locale: 'en-US',
    quiet_end_minute: 420,
    quiet_start_minute: 1320,
    summary_minute: 480,
    time_zone: 'America/Sao_Paulo',
    user_id: 'user-1',
  } as never);

  expect(preferences).toEqual(
    expect.objectContaining({ lastSummaryOn: '2026-11-22', locale: 'en-US' }),
  );
  expect(
    NotificationMapper.toPreferences({ last_summary_on: null, locale: 'pt-BR' } as never)
      .lastSummaryOn,
  ).toBeNull();
  expect(
    NotificationMapper.toDevice({
      enabled: true,
      id: 'd',
      last_seen_at: now,
      name: 'iPhone',
      platform: 'IOS',
      provider: 'EXPO',
      token: 'ExponentPushToken[x]',
      user_id: 'user-1',
      web_auth: null,
      web_p256dh: null,
    } as never),
  ).toEqual(expect.objectContaining({ lastSeenAt: now, userId: 'user-1' }));
});

describe('toPendingDelivery', () => {
  function delivery(kind: 'SUMMARY' | 'URGENT', items = [itemRow]) {
    return {
      attempts: 1,
      device: {
        provider: 'WEB_PUSH',
        token: 'https://push.example.com/x',
        web_auth: 'a',
        web_p256dh: 'p',
      },
      device_id: 'd-1',
      id: 'del-1',
      notification: noticeRow(kind, items),
    } as never;
  }

  it('SHOULD open the item route for an urgent notice AND the center for a summary', () => {
    expect(NotificationMapper.toPendingDelivery(delivery('URGENT')).route).toBe('/stock/items/i');
    expect(NotificationMapper.toPendingDelivery(delivery('SUMMARY')).route).toBe('/notifications');
  });

  it('SHOULD fall back to the center WHEN an urgent notice has no item', () => {
    expect(NotificationMapper.toPendingDelivery(delivery('URGENT', [])).route).toBe(
      '/notifications',
    );
  });
});
