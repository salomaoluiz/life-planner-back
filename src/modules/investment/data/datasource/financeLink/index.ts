import { Prisma } from '@db/client';

// Spec 102 section 14: the investment module writes its linked finance row and the account ledger itself, inside the
// same database transaction as the operation. This mirrors finance's `ledgerDeltas` rule for a PAID row: INCOME adds
// `value`, EXPENSE subtracts it, one atomic increment per account, accounts ordered by id.
export interface LedgerDelta {
  accountId: string;
  delta: number;
}
export interface LinkedRow {
  accountId: string;
  type: 'EXPENSE' | 'INCOME';
  value: number;
}

export async function applyDeltas(
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

// Reversing `before` and applying `after`, netted per account, zero dropped, ascending account id.
export function ledgerDeltasFor(before?: LinkedRow, after?: LinkedRow): LedgerDelta[] {
  const totals = new Map<string, number>();

  if (before) {
    totals.set(before.accountId, (totals.get(before.accountId) ?? 0) - signed(before));
  }
  if (after) {
    totals.set(after.accountId, (totals.get(after.accountId) ?? 0) + signed(after));
  }

  return toDeltas(totals);
}
export async function lockAccounts(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)].sort();

  if (unique.length === 0) {
    return;
  }

  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "financial_accounts" WHERE "id" IN (${Prisma.join(unique)}) ORDER BY "id" FOR UPDATE`,
  );
}
export async function lockAsset(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "investment_assets" WHERE "id" = ${id} FOR UPDATE`,
  );
}

// Net of many rows (asset delete): the reversal of each row.
export function reversalDeltas(rows: LinkedRow[]): LedgerDelta[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(row.accountId, (totals.get(row.accountId) ?? 0) - signed(row));
  }

  return toDeltas(totals);
}

function signed(row: LinkedRow): number {
  return row.type === 'INCOME' ? row.value : -row.value;
}
function toDeltas(totals: Map<string, number>): LedgerDelta[] {
  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([accountId, delta]) => ({ accountId, delta }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}
