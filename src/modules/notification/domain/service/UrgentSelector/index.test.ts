import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';

import { selectUrgent } from './index';

function item(
  sourceId: string,
  overrides: Partial<NotificationItemInput> = {},
): NotificationItemInput {
  return {
    dueDate: '2026-11-23',
    module: 'STOCK',
    owner: 'USER' as never,
    ownerId: 'user-1',
    route: '/r',
    snapshot: { description: sourceId },
    sourceId,
    state: 'DUE_TODAY',
    type: 'STOCK_EXPIRING',
    ...overrides,
  };
}

it('SHOULD keep only DUE_TODAY items', () => {
  const result = selectUrgent(
    [item('a'), item('b', { state: 'UPCOMING' }), item('c', { state: 'OVERDUE' })],
    new Set(),
  );

  expect(result.map((entry) => entry.sourceId)).toEqual(['a']);
});

it("SHOULD skip an item already part of today's summary or an earlier urgent notice", () => {
  const result = selectUrgent([item('a'), item('b')], new Set(['STOCK_EXPIRING:a:2026-11-23']));

  expect(result.map((entry) => entry.sourceId)).toEqual(['b']);
});

it('SHOULD treat a changed due date as a new key AND count a repeated candidate once', () => {
  const result = selectUrgent(
    [item('a', { dueDate: '2026-11-24' }), item('b'), item('b')],
    new Set(['STOCK_EXPIRING:a:2026-11-23']),
  );

  expect(result.map((entry) => entry.sourceId)).toEqual(['a', 'b']);
});
