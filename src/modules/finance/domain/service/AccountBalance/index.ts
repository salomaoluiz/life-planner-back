import AccountEntity from '@finance/domain/entity/AccountEntity';

export interface AccountWithBalances {
  account: AccountEntity;
  // initial + Σ signed(paid rows): the stored ledger
  balance: number;
  // balance + Σ signed(unpaid rows dated up to the last day of today's month)
  projectedBalance: number;
}
// Signed sum (income +, expense −) of the unpaid rows dated up to the end of today's month.
export interface UnpaidSums {
  accountId: string;
  dueByEndOfMonth: number;
}

// `today` is `YYYY-MM-DD`; the result is the last calendar day of that month.
export function endOfMonth(today: string): string {
  const [year, month] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// The ledger already counts only paid rows: the projection adds the unpaid ones due this month (overdue included).
export function withBalances(account: AccountEntity, unpaid?: UnpaidSums): AccountWithBalances {
  return {
    account,
    balance: account.ledgerBalance,
    projectedBalance: account.ledgerBalance + (unpaid?.dueByEndOfMonth ?? 0),
  };
}
