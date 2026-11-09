import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Spec 090 §9: a card-row write that forgets to refresh the stored invoice totals makes them drift. Every
// datasource that writes `financial_transactions` is listed with how many refresh calls it must hold (one per
// write method that can touch a card row); a new writer fails the test until it is listed.
const REQUIRED_REFRESH_CALLS: Record<string, number> = {
  FinanceCardCreditDatasource: 5,
  FinanceCreditCardDatasource: 1,
  FinanceInstallmentPlanDatasource: 4,
  FinanceOwnerDataDatasource: 1,
  FinancePrepaymentDatasource: 2,
  FinanceRecurrenceDatasource: 5,
  FinanceTransactionDatasource: 4,
};

// Writers whose changes never alter a total: the category copy of a family only swaps `category_id` to a user
// category (the early-payment total is keyed by the system category, which copies never touch); the invoice payment
// only creates the paid debit row of an ACCOUNT (no card); a transfer (spec 098) writes account rows only.
const NO_TOTALS_EFFECT = [
  'FinanceCategoryDatasource',
  'FinanceInvoicePaymentDatasource',
  'FinanceTransferDatasource',
];

const WRITE_CALL =
  /financialTransaction\.(create|createMany|createManyAndReturn|update|updateMany|delete|deleteMany|upsert)\(|batchUpdate\(\s*tx,\s*'financial_transactions'|INSERT INTO "financial_transactions"|UPDATE "financial_transactions"|DELETE FROM "financial_transactions"/;

const datasourceDir = join(__dirname, '..', 'src', 'modules', 'finance', 'data', 'datasource');

function sourceOf(name: string): string {
  return readFileSync(join(datasourceDir, name, 'index.ts'), 'utf8');
}

describe('card-row writers refresh the stored invoice totals (spec 090)', () => {
  it.each(Object.entries(REQUIRED_REFRESH_CALLS))(
    'SHOULD call refreshCardInvoiceTotals at least %s times in %s',
    (name, count) => {
      const calls = sourceOf(name).split('refreshCardInvoiceTotals(').length - 1;

      expect(calls).toBeGreaterThanOrEqual(count);
    },
  );

  it('SHOULD list every datasource that writes financial_transactions', () => {
    const writers = readdirSync(datasourceDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^Finance.*Datasource$/.test(entry.name))
      .map((entry) => entry.name)
      .filter((name) => WRITE_CALL.test(sourceOf(name)));

    expect(
      writers.filter(
        (name) => !(name in REQUIRED_REFRESH_CALLS) && !NO_TOTALS_EFFECT.includes(name),
      ),
    ).toEqual([]);
  });
});
