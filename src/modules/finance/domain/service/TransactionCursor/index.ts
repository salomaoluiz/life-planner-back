export interface TransactionCursor {
  createdAt: Date;
  date: Date;
  id: string;
}

export const TRANSACTION_PAGE_DEFAULT_LIMIT = 200;
export const TRANSACTION_PAGE_MAX_LIMIT = 500;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Spec 078: opaque position of a row in the list order (date, created_at, id), base64 of `date|created_at|id`.
export function encodeTransactionCursor(row: TransactionCursor): string {
  const parts = [row.date.toISOString().slice(0, 10), row.createdAt.toISOString(), row.id];

  return Buffer.from(parts.join('|')).toString('base64');
}

// `undefined` for anything that is not a cursor this API produced.
export function decodeTransactionCursor(cursor: string): TransactionCursor | undefined {
  const parts = Buffer.from(cursor, 'base64').toString('utf8').split('|');

  if (parts.length !== 3 || !DAY.test(parts[0]) || !parts[2]) {
    return undefined;
  }

  const date = new Date(`${parts[0]}T00:00:00.000Z`);
  const createdAt = new Date(parts[1]);

  if (Number.isNaN(date.getTime()) || Number.isNaN(createdAt.getTime())) {
    return undefined;
  }

  return { createdAt, date, id: parts[2] };
}
