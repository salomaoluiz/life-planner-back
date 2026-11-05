import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Spec 092 gate: every finance table that carries an owner (or hangs from one that does) has a deferred trigger that
// bumps the owner's data version, so no write path can serve a stale 304. A new owned finance table fails here until
// a migration adds its trigger (and, if the owner is not on the table itself, a dedicated trigger function).
const root = join(__dirname, '..');
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migrations = readdirSync(join(root, 'prisma/migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) =>
    readFileSync(join(root, 'prisma/migrations', entry.name, 'migration.sql'), 'utf8'),
  )
  .join('\n');

// Tables whose rows are read by an owner but never change what a finance GET answers by themselves.
const EXEMPT = new Set([
  'financial_card_invoice_totals', // derived from the transactions, which are bumped
  'category_icons', // global static catalog
  'finance_owner_versions', // the version table itself
  'stock_items', // not finance
]);

function ownedFinanceTables(): string[] {
  const tables: string[] = [];

  for (const block of schema.match(/^model \w+ \{[\s\S]*?^\}/gm) ?? []) {
    const table = /@@map\("(\w+)"\)/.exec(block)?.[1];

    if (table && /^\s+owner\s+OwnerType/m.test(block) && /^\s+owner_id\s/m.test(block)) {
      tables.push(table);
    }
  }

  return tables;
}

// Join tables that point at an owned row: their owner is the owner of that row.
const JOIN_TABLES = ['financial_transaction_tags', 'financial_recurrence_tags'];

describe('owner version triggers', () => {
  it.each(ownedFinanceTables().filter((table) => !EXEMPT.has(table)))(
    'SHOULD bump the owner version on every write of %s',
    (table) => {
      const pattern = new RegExp(
        `CREATE CONSTRAINT TRIGGER "\\w+" AFTER INSERT OR UPDATE OR DELETE ON "${table}" DEFERRABLE INITIALLY DEFERRED`,
      );

      expect(migrations).toMatch(pattern);
    },
  );

  it.each(JOIN_TABLES)('SHOULD bump the owner version on every write of %s', (table) => {
    expect(migrations).toMatch(
      new RegExp(`CREATE CONSTRAINT TRIGGER "\\w+" AFTER INSERT OR UPDATE OR DELETE ON "${table}"`),
    );
  });

  it('SHOULD find the owned finance tables it expects (the scan itself works)', () => {
    expect(ownedFinanceTables()).toEqual(
      expect.arrayContaining(['financial_accounts', 'financial_transactions', 'financial_tags']),
    );
  });
});
