import { Prisma } from '@db/client';
import { TransactionType } from '@finance/domain/enum';
import { LedgerDelta, LedgerEntry } from '@finance/domain/service/LedgerBalance';

interface LockedRow {
  account_id: string;
  type: string;
  value: number;
}

// One atomic increment per account (`ledger_balance = ledger_balance + delta`): never read, add, write.
// The caller passes the deltas already ordered by account id so concurrent writes lock in the same order.
export async function applyLedgerDeltas(
  tx: Prisma.TransactionClient,
  deltas: LedgerDelta[],
): Promise<void> {
  for (const { accountId, delta } of deltas) {
    await tx.financialAccount.update({
      data: { ledger_balance: { increment: delta } },
      where: { id: accountId },
    });
  }
}

// Reads the stored row INSIDE the database transaction and locks it until commit, so two concurrent
// edits of the same transaction cannot both reverse the same old value.
export async function lockTransactionRow(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<LedgerEntry | undefined> {
  const rows = await tx.$queryRaw<LockedRow[]>(
    Prisma.sql`SELECT "account_id", "type"::text AS "type", "value" FROM "financial_transactions" WHERE "id" = ${id} FOR UPDATE`,
  );

  return rows.length > 0 ? toLedgerEntry(rows[0]) : undefined;
}
export function toLedgerEntry(row: LockedRow): LedgerEntry {
  return {
    accountId: row.account_id,
    type: TransactionType[row.type as keyof typeof TransactionType],
    value: row.value,
  };
}
