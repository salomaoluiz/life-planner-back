import { UnprocessableEntityException } from '@nestjs/common';

import { OwnerType, Prisma } from '@db/client';
import { TransactionType } from '@finance/domain/enum';
import { LedgerDelta, LedgerEntry } from '@finance/domain/service/LedgerBalance';

export interface LockedTransactionRow extends LedgerEntry {
  creditCardId: null | string;
  invoiceMonth: null | string;
}

// The row of a write plus its owner, read by the same statement that locks it (spec 085).
export interface LockedWriteRow extends LockedTransactionRow {
  owner: OwnerType;
  ownerId: string;
}

interface LockedRow {
  account_id: null | string;
  credit_card_id: null | string;
  invoice_month: null | string;
  paid: boolean | null;
  type: string;
  value: number;
}
interface LockedWriteRaw extends LockedRow {
  owner: OwnerType;
  owner_id: string;
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

// Spec 086: the net delta of each account, zero totals dropped, ascending by account id (the lock order of
// `financial_accounts`). Per-row loops sum first and apply once.
export function sumLedgerDeltas(deltas: LedgerDelta[]): LedgerDelta[] {
  const totals = new Map<string, number>();

  for (const { accountId, delta } of deltas) {
    totals.set(accountId, (totals.get(accountId) ?? 0) + delta);
  }

  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([accountId, delta]) => ({ accountId, delta }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
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

// Creating or moving installments into an invoice that already has a payment is rejected (spec 030 FR 6).
export async function assertInvoicesNotPaid(
  tx: Prisma.TransactionClient,
  creditCardId: string,
  invoiceMonths: string[],
): Promise<void> {
  await failWhenPaid(tx, creditCardId, invoiceMonths, 'Invoice is paid');
}

// Value changes, recalculation and delete of a plan stop at the first paid installment (spec 030 FR 14, 15, 20).
export async function assertNoPaidInstallment(
  tx: Prisma.TransactionClient,
  creditCardId: string,
  invoiceMonths: string[],
): Promise<void> {
  await failWhenPaid(tx, creditCardId, invoiceMonths, 'An installment is in a paid invoice');
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
    Prisma.sql`SELECT "account_id", "credit_card_id", "invoice_month", "paid", "type"::text AS "type", "value" FROM "financial_transactions" WHERE "id" = ${id} FOR UPDATE`,
  );

  return rows.length > 0 ? toLockedRow(rows[0]) : undefined;
}
// Spec 085: ONE statement for the whole lock scope of an update or delete. The cards (the one of the stored row plus
// the ones the write moves to) are locked first, ascending id, in a materialized CTE the row select depends on; the
// row is locked and read after them. Same order as `lockCards` + `lockTransactionRow`: cards -> row.
export async function lockWriteScope(
  tx: Prisma.TransactionClient,
  params: { extraCardIds: string[]; rowId: string },
): Promise<LockedWriteRow | undefined> {
  const extra = [...new Set(params.extraCardIds)].sort();
  const cardMatches = [
    Prisma.sql`c."id" IN (SELECT t0."credit_card_id" FROM "financial_transactions" t0 WHERE t0."id" = ${params.rowId} AND t0."credit_card_id" IS NOT NULL)`,
    ...(extra.length > 0 ? [Prisma.sql`c."id" IN (${Prisma.join(extra)})`] : []),
  ];
  const rows = await tx.$queryRaw<LockedWriteRaw[]>(
    Prisma.sql`WITH "locked_cards" AS MATERIALIZED (SELECT c."id" FROM "financial_credit_cards" c WHERE ${Prisma.join(cardMatches, ' OR ')} ORDER BY c."id" FOR UPDATE) SELECT t."account_id", t."credit_card_id", t."invoice_month", t."owner"::text AS "owner", t."owner_id", t."paid", t."type"::text AS "type", t."value" FROM "financial_transactions" t WHERE t."id" = ${params.rowId} AND (SELECT count(*) FROM "locked_cards") >= 0 FOR UPDATE OF t`,
  );

  return rows.length > 0
    ? { ...toLockedRow(rows[0]), owner: rows[0].owner, ownerId: rows[0].owner_id }
    : undefined;
}
export function toLedgerEntry(row: {
  account_id: null | string;
  paid: boolean | null;
  type: string;
  value: number;
}): LedgerEntry {
  return {
    accountId: row.account_id,
    paid: row.paid === true,
    type: TransactionType[row.type as keyof typeof TransactionType],
    value: row.value,
  };
}

async function failWhenPaid(
  tx: Prisma.TransactionClient,
  creditCardId: string,
  invoiceMonths: string[],
  message: string,
): Promise<void> {
  const payment = await tx.financialInvoicePayment.findFirst({
    select: { id: true },
    where: { credit_card_id: creditCardId, invoice_month: { in: invoiceMonths } },
  });

  if (payment) {
    throw new UnprocessableEntityException(message);
  }
}
function toLockedRow(row: LockedRow): LockedTransactionRow {
  return {
    ...toLedgerEntry(row),
    creditCardId: row.credit_card_id,
    invoiceMonth: row.invoice_month,
  };
}
