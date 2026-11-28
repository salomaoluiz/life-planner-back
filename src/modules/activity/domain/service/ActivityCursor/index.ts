export interface ActivityCursor {
  id: string;
  occurredAt: Date;
}
export interface ItemCursor {
  bookingDate: null | string;
  id: string;
}

const SEPARATOR = '|';

function decode(cursor: string): string[] {
  return Buffer.from(cursor, 'base64').toString('utf8').split(SEPARATOR);
}
function encode(parts: string[]): string {
  return Buffer.from(parts.join(SEPARATOR)).toString('base64');
}

// Spec 127 FR 9: opaque position in the (occurred_at DESC, id DESC) order.
export function encodeActivityCursor(row: ActivityCursor): string {
  return encode([row.occurredAt.toISOString(), row.id]);
}

// `undefined` for anything that is not a cursor this API produced (the API answers 400).
export function decodeActivityCursor(cursor: string): ActivityCursor | undefined {
  const [occurredAt, id, ...extra] = decode(cursor);
  const date = new Date(occurredAt);

  if (extra.length > 0 || !id || Number.isNaN(date.getTime())) {
    return undefined;
  }

  return { id, occurredAt: date };
}

// FR 11: position in the (booking_date DESC NULLS LAST, id DESC) order of a batch.
export function decodeItemCursor(cursor: string): ItemCursor | undefined {
  const [bookingDate, id, ...extra] = decode(cursor);

  if (extra.length > 0 || !id || (bookingDate !== '' && Number.isNaN(Date.parse(bookingDate)))) {
    return undefined;
  }

  return { bookingDate: bookingDate === '' ? null : bookingDate, id };
}
export function encodeItemCursor(row: ItemCursor): string {
  return encode([row.bookingDate ?? '', row.id]);
}
