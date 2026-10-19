import { addDays, lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';

// Signed cents (income +, expense −) of one account on one calendar day.
export interface DailyBalanceInput {
  accounts: { accountId: string; opening: number }[];
  // Signed (negative) invoices that are not counted inside an account.
  cardsDue: { amount: number; date: string }[];
  // `YYYY-MM`
  month: string;
  // Paid rows dated within the month.
  paid: DatedAmount[];
  // Unpaid rows, projected account occurrences and linked invoices, any date up to the end of the month.
  pending: DatedAmount[];
  today: string;
}
export interface DatedAmount {
  accountId: string;
  amount: number;
  // `YYYY-MM-DD`
  date: string;
}
export interface DayBalance {
  accounts: { accountId: string; balance: number }[];
  cardsDue: number;
  date: string;
  projected: boolean;
  total: number;
}

// Spec 035 FR 1, 6, 8: paid rows count on their own date; pending items only on days from `today` on,
// starting at `max(date, today)` (overdue ones count from today).
export function buildDailyBalances(input: DailyBalanceInput): DayBalance[] {
  const first = `${input.month}-01`;
  const last = lastDayOfMonth(first);
  const paidByDay = bucket(input.paid, (item) => item.date);
  const pendingByDay = bucket(input.pending, (item) => effectiveDate(item.date, input.today));
  const cardsByDay = bucket(
    input.cardsDue.map((item) => ({ ...item, accountId: '' })),
    (item) => effectiveDate(item.date, input.today),
  );
  const balances = new Map(input.accounts.map((account) => [account.accountId, account.opening]));
  let cards = 0;

  for (const [date, items] of pendingByDay) {
    if (date < first) {
      add(balances, items);
    }
  }
  for (const [date, items] of cardsByDay) {
    if (date < first) {
      cards += sum(items);
    }
  }

  const futureDates = [...input.pending, ...input.cardsDue]
    .map((item) => item.date)
    .filter((date) => date > input.today);
  const earliestFuture = futureDates.length > 0 ? futureDates.reduce(min) : undefined;
  const days: DayBalance[] = [];

  for (let date = first; date <= last; date = addDays(date, 1)) {
    add(balances, paidByDay.get(date) ?? []);
    add(balances, pendingByDay.get(date) ?? []);
    cards += sum(cardsByDay.get(date) ?? []);

    const accounts = input.accounts.map((account) => ({
      accountId: account.accountId,
      balance: balances.get(account.accountId) ?? 0,
    }));

    days.push({
      accounts,
      cardsDue: cards,
      date,
      projected: date > input.today && earliestFuture !== undefined && earliestFuture <= date,
      total: accounts.reduce((total, account) => total + account.balance, cards),
    });
  }

  return days;
}

function add(balances: Map<string, number>, items: DatedAmount[]): void {
  for (const item of items) {
    if (balances.has(item.accountId)) {
      balances.set(item.accountId, (balances.get(item.accountId) ?? 0) + item.amount);
    }
  }
}
function bucket<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();

  for (const item of items) {
    const key = keyOf(item);

    result.set(key, [...(result.get(key) ?? []), item]);
  }

  return result;
}
function effectiveDate(date: string, today: string): string {
  return date > today ? date : today;
}
function min(a: string, b: string): string {
  return a < b ? a : b;
}
function sum(items: { amount: number }[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}
