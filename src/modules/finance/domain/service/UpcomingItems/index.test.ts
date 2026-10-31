import { UpcomingItem } from '@finance/domain/entity/UpcomingItem';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { splitUpcoming } from './index';

function item(date: string, overrides: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    accountId: 'account',
    categoryId: 'category',
    creditCardId: null,
    currency: 'BRL',
    date,
    description: 'Rent',
    id: `id-${date}-${overrides.valueCents ?? 100}`,
    invoiceMonth: null,
    kind: 'TRANSACTION',
    occurrenceNumber: null,
    owner: OwnerType.USER,
    ownerId: 'owner',
    purchaseCount: null,
    recurrenceId: null,
    type: TransactionType.EXPENSE,
    valueCents: 100,
    ...overrides,
  };
}

describe('splitUpcoming', () => {
  const today = '2026-11-12';

  it('SHOULD put today in next and yesterday in overdue', () => {
    const result = splitUpcoming([item('2026-11-12'), item('2026-11-11')], today, 7, 5);

    expect(result.next.map((row) => row.date)).toEqual(['2026-11-12']);
    expect(result.overdue.map((row) => row.date)).toEqual(['2026-11-11']);
  });

  it('SHOULD include today + days and drop anything later', () => {
    const result = splitUpcoming([item('2026-11-19'), item('2026-11-20')], today, 7, 5);

    expect(result.next.map((row) => row.date)).toEqual(['2026-11-19']);
    expect(result.nextTotal).toBe(1);
  });

  it('SHOULD list every overdue item, oldest first', () => {
    const dates = Array.from(
      { length: 30 },
      (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`,
    );
    const result = splitUpcoming(
      [...dates].reverse().map((date) => item(date)),
      today,
      7,
      5,
    );

    expect(result.overdue).toHaveLength(30);
    expect(result.overdue[0].date).toBe('2026-10-01');
  });

  it('SHOULD cut next to the limit and report the total before the cut', () => {
    const rows = ['13', '14', '15', '16', '17', '18', '19'].map((day) => item(`2026-11-${day}`));
    const result = splitUpcoming([...rows].reverse(), today, 7, 5);

    expect(result.next.map((row) => row.date)).toEqual(rows.slice(0, 5).map((row) => row.date));
    expect(result.nextTotal).toBe(7);
  });

  it('SHOULD sum overdue expenses and incomes apart', () => {
    const result = splitUpcoming(
      [
        item('2026-11-01', { valueCents: 500 }),
        item('2026-11-02', { valueCents: 700 }),
        item('2026-11-03', { type: TransactionType.INCOME, valueCents: 900 }),
      ],
      today,
      7,
      5,
    );

    expect(result.overdueTotals).toEqual({ expenseCents: 1200, incomeCents: 900 });
  });

  it('SHOULD keep an item three years overdue', () => {
    expect(splitUpcoming([item('2023-05-01')], today, 7, 5).overdue).toHaveLength(1);
  });

  it('SHOULD cross the year end', () => {
    const result = splitUpcoming([item('2027-01-04')], '2026-12-28', 7, 5);

    expect(result.next).toHaveLength(1);
  });
});
