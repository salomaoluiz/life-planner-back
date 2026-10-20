import { addDays } from '@finance/domain/service/RecurrenceSchedule';

// Spec 045: the optional filters of the transactions, invoices and projections lists.
// Values inside one field combine with OR, different fields with AND.
export interface TransactionFilter {
  accountIds?: string[];
  categoryIds?: string[];
  creditCardIds?: string[];
  // `YYYY-MM-DD`, both inclusive and always together.
  from?: string;
  paid?: boolean;
  q?: string;
  tagIds?: string[];
  to?: string;
}

export function hasFilter(filter?: TransactionFilter): boolean {
  if (!filter) {
    return false;
  }

  return Object.values(filter).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined,
  );
}

// `to` is on or after `from` and at most `from` + 2 years - 1 day.
export function isPeriodValid(from: string, to: string): boolean {
  if (to < from) {
    return false;
  }

  const [year, month, day] = from.split('-').map(Number);
  const limit = new Date(Date.UTC(year + 2, month - 1, day)).toISOString().slice(0, 10);

  return to <= addDays(limit, -1);
}
