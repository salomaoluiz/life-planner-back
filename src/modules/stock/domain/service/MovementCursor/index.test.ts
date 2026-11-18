import { decodeMovementCursor, encodeMovementCursor } from './index';

it('SHOULD round-trip a cursor', () => {
  const row = { createdAt: new Date('2026-11-10T12:00:00.000Z'), id: 'abc' };

  expect(decodeMovementCursor(encodeMovementCursor(row))).toEqual(row);
});

it.each([
  '',
  'not-base64!!',
  Buffer.from('2026-11-10T00:00:00.000Z').toString('base64'),
  Buffer.from('x|y').toString('base64'),
  Buffer.from('2026-11-10T00:00:00.000Z|a|b').toString('base64'),
])('SHOULD reject %j', (cursor) => {
  expect(decodeMovementCursor(cursor)).toBeUndefined();
});
