import { UnprocessableEntityException } from '@nestjs/common';

import { Prisma } from '@db/client';
import { TransactionType } from '@finance/domain/enum';
import { LedgerDelta, LedgerEntry } from '@finance/domain/service/LedgerBalance';

export interface LockedTransactionRow extends LedgerEntry {
  creditCardId: null | string;
  invoiceMonth: null | string;
}

interface LockedRow {
  account_id: null | string;
  credit_card_id: null | string;
  invoice_month: null | string;
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

// A purchase can't be written into (or out of) an invoice that already has a payment (spec 029 FR 7).
export async function assertInvoiceNotPaid(
  tx: Prisma.TransactionClient,
  creditCardId: null | string | undefined,
  invoiceMonth: null | string | undefined,
): Promise<void> {
  if (!creditCardId || !invoiceMonth) {
    return;
  }

  const payment = await tx.financialInvoicePayment.findFirst({
    select: { id: true },
    where: { credit_card_id: creditCardId, invoice_month: invoiceMonth },
  });

  if (payment) {
    throw new UnprocessableEntityException('Invoice is paid');
  }
}

// Locks the card rows (ascending id) until commit: a payment and a purchase on the same invoice serialize here.
export async function lockCards(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)].sort();

  if (unique.length === 0) {
    return;
  }

  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "financial_credit_cards" WHERE "id" IN (${Prisma.join(unique)}) ORDER BY "id" FOR UPDATE`,
  );
}

// Reads the stored row INSIDE the database transaction and locks it until commit, so two concurrent
// edits of the same transaction cannot both reverse the same old value.
export async function lockTransactionRow(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<LockedTransactionRow | undefined> {
  const rows = await tx.$queryRaw<LockedRow[]>(
    Prisma.sql`SELECT "account_id", "credit_card_id", "invoice_month", "type"::text AS "type", "value" FROM "financial_transactions" WHERE "id" = ${id} FOR UPDATE`,
  );

  return rows.length > 0 ? toLockedRow(rows[0]) : undefined;
}
export function toLedgerEntry(row: {
  account_id: null | string;
  type: string;
  value: number;
}): LedgerEntry {
  return {
    accountId: row.account_id,
    type: TransactionType[row.type as keyof typeof TransactionType],
    value: row.value,
  };
}

function toLockedRow(row: LockedRow): LockedTransactionRow {
  return {
    ...toLedgerEntry(row),
    creditCardId: row.credit_card_id,
    invoiceMonth: row.invoice_month,
  };
}
