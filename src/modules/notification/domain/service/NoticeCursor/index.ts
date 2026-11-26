export interface NoticeCursor {
  createdAt: Date;
  id: string;
}

export const NOTICE_PAGE_SIZE = 20;

// Spec 124 FR 18: opaque position in the (created_at DESC, id DESC) order, base64 of `created_at|id`.
export function encodeNoticeCursor(row: NoticeCursor): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64');
}

// `undefined` for anything that is not a cursor this API produced (the API answers 400).
export function decodeNoticeCursor(cursor: string): NoticeCursor | undefined {
  const [createdAt, id, ...extra] = Buffer.from(cursor, 'base64').toString('utf8').split('|');
  const date = new Date(createdAt);

  if (extra.length > 0 || !id || Number.isNaN(date.getTime())) {
    return undefined;
  }

  return { createdAt: date, id };
}
