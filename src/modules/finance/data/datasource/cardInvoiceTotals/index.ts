import { Prisma } from '@db/client';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';

// Spec 090: the stored totals of `financial_card_invoice_totals` (shadow mode: written, not read until spec 091).
// EVERY write of a card row (create, update, delete, move between invoices or cards, import, refund, early payment,
// prepayment, installment, recurrence) calls `refreshCardInvoiceTotals` with the (card, invoice month) pairs it
// touched, BEFORE and AFTER the write, inside the same database transaction and after the card locks.
// The totals of each pair are recomputed exactly from its rows (idempotent, so a superset of the touched pairs is
// harmless) in ONE statement: no per-site old/new bookkeeping can drift, and the card lock serializes writers.
export interface CardInvoiceKey {
  creditCardId: string;
  invoiceMonth: string;
}

interface MaybeKeyRow {
  credit_card_id?: null | string;
  invoice_month?: null | string;
}

// The distinct pairs of the rows that sit on a card (account rows are ignored), ascending by card then month.
export function invoiceTotalsKeysOf(rows: MaybeKeyRow[]): CardInvoiceKey[] {
  const keys = new Map<string, CardInvoiceKey>();

  for (const row of rows) {
    if (row.credit_card_id && row.invoice_month) {
      keys.set(`${row.credit_card_id}|${row.invoice_month}`, {
        creditCardId: row.credit_card_id,
        invoiceMonth: row.invoice_month,
      });
    }
  }

  return [...keys.values()].sort(
    (a, b) =>
      a.creditCardId.localeCompare(b.creditCardId) || a.invoiceMonth.localeCompare(b.invoiceMonth),
  );
}

// The pairs of the card rows that match `where` right now (read it BEFORE a write that moves or removes them).
export async function invoiceTotalsKeysWhere(
  tx: Prisma.TransactionClient,
  where: Prisma.FinancialTransactionWhereInput,
): Promise<CardInvoiceKey[]> {
  const rows = await tx.financialTransaction.findMany({
    distinct: ['credit_card_id', 'invoice_month'],
    select: { credit_card_id: true, invoice_month: true },
    where: { AND: [where, { credit_card_id: { not: null } }] },
  });

  return invoiceTotalsKeysOf(rows);
}

// Recomputes the stored totals of every pair in ONE statement; a pair with no rows left is removed.
export async function refreshCardInvoiceTotals(
  tx: Prisma.TransactionClient,
  keys: CardInvoiceKey[],
): Promise<void> {
  const unique = invoiceTotalsKeysOf(
    keys.map((key) => ({ credit_card_id: key.creditCardId, invoice_month: key.invoiceMonth })),
  );

  if (unique.length === 0) {
    return;
  }

  const earlyPaymentId = SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_EARLY_PAYMENT];
  const tuples = unique.map(
    (key) => Prisma.sql`(${key.creditCardId}::text, ${key.invoiceMonth}::char(7))`,
  );

  await tx.$executeRaw(
    Prisma.sql`WITH "k"("credit_card_id", "invoice_month") AS (VALUES ${Prisma.join(tuples, ', ')}), "agg" AS (SELECT k."credit_card_id", k."invoice_month", COALESCE(SUM(t."value") FILTER (WHERE t."type" = 'INCOME'), 0)::int AS "income", COALESCE(SUM(t."value") FILTER (WHERE t."type" = 'EXPENSE'), 0)::int AS "expense", COALESCE(SUM(t."value") FILTER (WHERE t."category_id" = ${earlyPaymentId}), 0)::int AS "early_paid", COUNT(t."id")::int AS "purchase_count" FROM "k" k LEFT JOIN "financial_transactions" t ON t."credit_card_id" = k."credit_card_id" AND t."invoice_month" = k."invoice_month" GROUP BY k."credit_card_id", k."invoice_month"), "gone" AS (DELETE FROM "financial_card_invoice_totals" x USING "agg" a WHERE x."credit_card_id" = a."credit_card_id" AND x."invoice_month" = a."invoice_month" AND a."purchase_count" = 0) INSERT INTO "financial_card_invoice_totals" ("credit_card_id", "invoice_month", "income", "expense", "early_paid", "purchase_count", "updated_at") SELECT a."credit_card_id", a."invoice_month", a."income", a."expense", a."early_paid", a."purchase_count", now() FROM "agg" a WHERE a."purchase_count" > 0 ON CONFLICT ("credit_card_id", "invoice_month") DO UPDATE SET "income" = EXCLUDED."income", "expense" = EXCLUDED."expense", "early_paid" = EXCLUDED."early_paid", "purchase_count" = EXCLUDED."purchase_count", "updated_at" = now()`,
  );
}
