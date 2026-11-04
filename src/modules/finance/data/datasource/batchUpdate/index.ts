import { Prisma } from '@db/client';

// Spec 086: one `UPDATE ... FROM (VALUES ...)` per chunk instead of one statement per row.
// Values are always bound parameters with an explicit cast; identifiers are validated and quoted.
// Not for ledger increments: `UPDATE ... FROM VALUES` doesn't lock rows in a defined order (use `sumLedgerDeltas`).
export type BatchCast = 'boolean' | 'char(7)' | 'date' | 'integer' | 'text';
export interface BatchColumn {
  cast: BatchCast;
  name: string;
}
export type BatchValue = boolean | null | number | string;

// `values[i]` belongs to `columns[i]`.
export interface BatchRow {
  key: string;
  values: BatchValue[];
}

export const BATCH_CHUNK_SIZE = 500;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export async function batchUpdate(
  tx: Prisma.TransactionClient,
  table: string,
  keyColumn: string,
  columns: BatchColumn[],
  rows: BatchRow[],
): Promise<number> {
  [table, keyColumn, ...columns.map((column) => column.name)].forEach(assertIdentifier);

  const keys = new Set<string>();

  for (const row of rows) {
    if (row.values.length !== columns.length) {
      throw new Error(
        `batchUpdate row ${row.key} has ${row.values.length} values for ${columns.length} columns`,
      );
    }
    if (keys.has(row.key)) {
      throw new Error(`Duplicate key in batchUpdate: ${row.key}`);
    }

    keys.add(row.key);
  }

  let updated = 0;

  for (let start = 0; start < rows.length; start += BATCH_CHUNK_SIZE) {
    updated += await tx.$executeRaw(
      statementOf(table, keyColumn, columns, rows.slice(start, start + BATCH_CHUNK_SIZE)),
    );
  }

  return updated;
}

function assertIdentifier(name: string): void {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
}
function quote(name: string): Prisma.Sql {
  return Prisma.raw(`"${name}"`);
}
function statementOf(
  table: string,
  keyColumn: string,
  columns: BatchColumn[],
  rows: BatchRow[],
): Prisma.Sql {
  const tuples = rows.map(
    (row) =>
      Prisma.sql`(${Prisma.join(
        [
          Prisma.sql`${row.key}::text`,
          ...row.values.map(
            (value, index) => Prisma.sql`${value}::${Prisma.raw(columns[index].cast)}`,
          ),
        ],
        ', ',
      )})`,
  );
  const assignments = columns.map(
    (column) => Prisma.sql`${quote(column.name)} = v.${quote(column.name)}`,
  );
  const names = [keyColumn, ...columns.map((column) => column.name)].map(quote);

  return Prisma.sql`UPDATE ${quote(table)} AS t SET ${Prisma.join(assignments, ', ')} FROM (VALUES ${Prisma.join(tuples, ', ')}) AS v(${Prisma.join(names, ', ')}) WHERE t.${quote(keyColumn)} = v.${quote(keyColumn)}`;
}
