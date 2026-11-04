import { decodeTransactionCursor, encodeTransactionCursor } from './index';

const row = {
  createdAt: new Date('2026-11-03T10:00:00.000Z'),
  date: new Date('2026-11-03T00:00:00.000Z'),
  id: '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10',
};

describe('transaction cursor', () => {
  it('SHOULD round trip a row position', () => {
    expect(decodeTransactionCursor(encodeTransactionCursor(row))).toEqual(row);
  });

  it.each([
    ['not base64!'],
    [''],
    [Buffer.from('a|b').toString('base64')],
    [Buffer.from('x|y|z').toString('base64')],
    [Buffer.from('2026-11-03|2026-11-03T10:00:00.000Z|').toString('base64')],
    [Buffer.from('2026-11-03|2026-11-03T10:00:00.000Z|id|extra').toString('base64')],
  ])('SHOULD return undefined WHEN the cursor is %p', (cursor) => {
    expect(decodeTransactionCursor(cursor)).toBeUndefined();
  });
});
