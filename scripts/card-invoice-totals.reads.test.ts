import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Spec 091 §9: no route computes invoice totals by grouping the card history any more; the totals come from
// `financial_card_invoice_totals` (written by spec 090). Scans the source for the old method.
function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    return statSync(path).isDirectory()
      ? sourcesUnder(path)
      : path.endsWith('.ts') && !path.endsWith('.test.ts')
        ? [path]
        : [];
  });
}

describe('card invoice totals are read from the stored table (spec 091)', () => {
  it('SHOULD NOT reference sumCardInvoices anywhere in src', () => {
    const offenders = sourcesUnder(join(__dirname, '..', 'src')).filter((path) =>
      readFileSync(path, 'utf8').includes('sumCardInvoices'),
    );

    expect(offenders).toEqual([]);
  });

  it('SHOULD read the stored totals in the transaction datasource', () => {
    const source = readFileSync(
      join(
        __dirname,
        '..',
        'src',
        'modules',
        'finance',
        'data',
        'datasource',
        'FinanceTransactionDatasource',
        'index.ts',
      ),
      'utf8',
    );

    expect(source).toContain('financialCardInvoiceTotal.findMany');
  });
});
