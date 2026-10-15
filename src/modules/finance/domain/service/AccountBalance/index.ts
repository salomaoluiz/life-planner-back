import AccountEntity from '@finance/domain/entity/AccountEntity';

export interface AccountWithBalances {
  account: AccountEntity;
  // initial + Σ signed(date <= today)
  balance: number;
  // initial + Σ signed(date <= last day of today's month)
  projectedBalance: number;
}
// Signed sums (income +, expense −) of the rows dated after `today` / after the end of its month.
export interface FutureSums {
  accountId: string;
  afterEndOfMonth: number;
  afterToday: number;
}

// `today` is `YYYY-MM-DD`; the result is the last calendar day of that month.
export function endOfMonth(today: string): string {
  const [year, month] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// The ledger counts every transaction whatever its date, so the derived balances subtract the future rows.
export function withBalances(account: AccountEntity, future?: FutureSums): AccountWithBalances {
  return {
    account,
    balance: account.ledgerBalance - (future?.afterToday ?? 0),
    projectedBalance: account.ledgerBalance - (future?.afterEndOfMonth ?? 0),
  };
}
