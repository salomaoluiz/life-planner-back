import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';

import { filterItemsForUser, NoticeFilterRules, ownerKey } from './index';

function item(overrides: Partial<NotificationItemInput> = {}): NotificationItemInput {
  return {
    dueDate: '2026-11-23',
    module: 'FINANCE',
    owner: 'USER' as never,
    ownerId: 'user-1',
    route: '/r',
    snapshot: { description: 'x' },
    sourceId: 's',
    state: 'DUE_TODAY',
    type: 'FINANCE_BILL_DUE',
    ...overrides,
  };
}
const rules: NoticeFilterRules = {
  allowedOwnerKeys: new Set([ownerKey('FAMILY', 'family-1'), ownerKey('USER', 'user-1')]),
  disabledTypes: [],
  leadDays: { FINANCE_BILL_DUE: 3, FINANCE_INVOICE_DUE: 5 },
  localDate: '2026-11-23',
};

it('SHOULD drop items of owners the user is not notified about (not a member, family off, archived)', () => {
  const result = filterItemsForUser(
    [
      item(),
      item({ owner: 'FAMILY' as never, ownerId: 'family-1' }),
      item({ owner: 'FAMILY' as never, ownerId: 'family-2' }),
    ],
    rules,
  );

  expect(result.map((entry) => entry.ownerId)).toEqual(['user-1', 'family-1']);
});

it('SHOULD drop the types the user turned off AND keep the others', () => {
  const result = filterItemsForUser(
    [item({ type: 'FINANCE_INVOICE_DUE' }), item({ type: 'FINANCE_BILL_DUE' })],
    { ...rules, disabledTypes: ['FINANCE_INVOICE_DUE'] },
  );

  expect(result.map((entry) => entry.type)).toEqual(['FINANCE_BILL_DUE']);
});

it('SHOULD apply the lead days of the type: invoiceLeadDays 5 keeps day 5 and drops day 6', () => {
  const result = filterItemsForUser(
    [
      item({
        dueDate: '2026-11-28',
        sourceId: 'in5',
        state: 'UPCOMING',
        type: 'FINANCE_INVOICE_DUE',
      }),
      item({
        dueDate: '2026-11-29',
        sourceId: 'in6',
        state: 'UPCOMING',
        type: 'FINANCE_INVOICE_DUE',
      }),
    ],
    rules,
  );

  expect(result.map((entry) => entry.sourceId)).toEqual(['in5']);
});

it('SHOULD keep overdue items AND stock items (their window already came from the item)', () => {
  const result = filterItemsForUser(
    [
      item({ dueDate: '2026-11-10', sourceId: 'late', state: 'OVERDUE' }),
      item({
        dueDate: '2026-12-20',
        module: 'STOCK',
        sourceId: 'lot',
        state: 'UPCOMING',
        type: 'STOCK_EXPIRING',
      }),
    ],
    rules,
  );

  expect(result.map((entry) => entry.sourceId)).toEqual(['late', 'lot']);
});
