import 'dotenv/config';
import { Client } from 'pg';

import { compareInvoiceTotals, InvoiceTotalsRow } from './compare';

// Spec 090 FR 4: read-only comparison of the stored invoice totals with the aggregation of the card rows (every card row, no
// exclusions) over the whole development database. Exit 0 = in sync, 1 = mismatches, 2 = could not run.
const EARLY_PAYMENT_CATEGORY_ID = '00000000-0000-4000-8000-000000000005';
const MAX_LINES = 30;

interface RawRow {
  credit_card_id: string;
  early_paid: number | string;
  expense: number | string;
  income: number | string;
  invoice_month: string;
  projected_amount: number | string;
  projected_count: number | string;
  purchase_count: number | string;
}

function toRows(rows: RawRow[]): InvoiceTotalsRow[] {
  return rows.map((row) => ({
    creditCardId: row.credit_card_id,
    earlyPaid: Number(row.early_paid),
    expense: Number(row.expense),
    income: Number(row.income),
    invoiceMonth: row.invoice_month,
    projectedAmount: Number(row.projected_amount),
    projectedCount: Number(row.projected_count),
    purchaseCount: Number(row.purchase_count),
  }));
}

async function main(): Promise<number> {
  if (process.env.NODE_ENV === 'production') {
    console.error('invoice totals check refused: NODE_ENV is production');

    return 2;
  }

  const client = new Client({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
  });

  await client.connect();

  try {
    const stored = await client.query<RawRow>(
      'SELECT credit_card_id, invoice_month, income, expense, early_paid, purchase_count, projected_amount, projected_count FROM financial_card_invoice_totals',
    );
    const computed = await client.query<RawRow>(
      `SELECT credit_card_id, invoice_month,
        COALESCE(SUM(value) FILTER (WHERE type = 'INCOME' AND NOT projected), 0) AS income,
        COALESCE(SUM(value) FILTER (WHERE type = 'EXPENSE' AND NOT projected), 0) AS expense,
        COALESCE(SUM(value) FILTER (WHERE category_id = $1), 0) AS early_paid,
        COUNT(*) FILTER (WHERE NOT projected) AS purchase_count,
        COALESCE(SUM(value) FILTER (WHERE projected), 0) AS projected_amount,
        COUNT(*) FILTER (WHERE projected) AS projected_count
       FROM financial_transactions WHERE credit_card_id IS NOT NULL
       GROUP BY credit_card_id, invoice_month`,
      [EARLY_PAYMENT_CATEGORY_ID],
    );
    const mismatches = compareInvoiceTotals(toRows(stored.rows), toRows(computed.rows));

    console.log(
      `invoice totals: ${computed.rows.length} invoices checked, ${mismatches.length} mismatches`,
    );
    mismatches.slice(0, MAX_LINES).forEach((line) => console.log(`  ${line}`));

    return mismatches.length === 0 ? 0 : 1;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(`invoice totals check could not run: ${(error as Error).message}`);
    process.exit(2);
  });
