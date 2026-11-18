export interface MovementCursor {
  createdAt: Date;
  id: string;
}

export const MOVEMENT_PAGE_SIZE = 30;

// Opaque position in the history order (created_at DESC, id DESC): base64 of `created_at|id`.
export function encodeMovementCursor(row: MovementCursor): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64');
}

// `undefined` for anything this API did not produce.
export function decodeMovementCursor(cursor: string): MovementCursor | undefined {
  const [createdAt, id, ...rest] = Buffer.from(cursor, 'base64').toString('utf8').split('|');
  const date = new Date(createdAt);

  if (rest.length > 0 || !id || Number.isNaN(date.getTime())) {
    return undefined;
  }

  return { createdAt: date, id };
}
