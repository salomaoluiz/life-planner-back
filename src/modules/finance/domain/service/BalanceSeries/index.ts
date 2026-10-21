import { DatedAmount } from '@finance/domain/service/DailyBalance';

// Spec 046 FR 10/12: the balance of each account at the end of given days. The ledger holds every paid row
// whatever its date, so the balance at the end of a day is the ledger minus the paid rows dated after it.
export interface AccountBalance {
  accountId: string;
  balance: number;
}
export interface LedgerAccount {
  accountId: string;
  ledger: number;
}

export function balancesAtEnds(
  accounts: LedgerAccount[],
  paidRows: DatedAmount[],
  ends: string[],
): AccountBalance[][] {
  return ends.map((end) =>
    accounts.map((account) => ({
      accountId: account.accountId,
      balance:
        account.ledger -
        paidRows
          .filter((row) => row.accountId === account.accountId && row.date > end)
          .reduce((total, row) => total + row.amount, 0),
    })),
  );
}
export function totalOf(balances: AccountBalance[]): number {
  return balances.reduce((total, item) => total + item.balance, 0);
}
