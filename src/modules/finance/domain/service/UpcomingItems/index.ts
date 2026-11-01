import { UpcomingItem } from '@finance/domain/entity/UpcomingItem';
import { TransactionType } from '@finance/domain/enum';
import { addDays } from '@finance/domain/service/RecurrenceSchedule';

export interface UpcomingSplit {
  next: UpcomingItem[];
  // How many items matched the next-days window before the cut to `limit`.
  nextTotal: number;
  overdue: UpcomingItem[];
  overdueTotals: { expenseCents: number; incomeCents: number };
}

// Spec 062 FR 14/15/22: overdue = before `today` (no limit, oldest first); next = `today`..`today + days`
// (inclusive, date ascending, cut to `limit`). Later items are not upcoming.
export function splitUpcoming(
  items: UpcomingItem[],
  today: string,
  days: number,
  limit: number,
): UpcomingSplit {
  const last = addDays(today, days);
  const overdue = items.filter((item) => item.date < today).sort(byDate);
  const next = items.filter((item) => item.date >= today && item.date <= last).sort(byDate);

  return {
    next: next.slice(0, limit),
    nextTotal: next.length,
    overdue,
    overdueTotals: {
      expenseCents: sumOf(overdue, TransactionType.EXPENSE),
      incomeCents: sumOf(overdue, TransactionType.INCOME),
    },
  };
}

function byDate(a: UpcomingItem, b: UpcomingItem): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}
function sumOf(items: UpcomingItem[], type: TransactionType): number {
  return items
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.valueCents, 0);
}
