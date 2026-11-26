import { dedupeKeyOf } from './NotificationItem';

it('SHOULD build the key from type, source and due date (a new date is a new key)', () => {
  const item = { dueDate: '2026-11-23', sourceId: 'lot-1', type: 'STOCK_EXPIRING' } as const;

  expect(dedupeKeyOf(item)).toBe('STOCK_EXPIRING:lot-1:2026-11-23');
  expect(dedupeKeyOf({ ...item, dueDate: '2026-11-24' })).not.toBe(dedupeKeyOf(item));
});
