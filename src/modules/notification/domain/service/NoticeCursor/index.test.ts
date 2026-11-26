import { decodeNoticeCursor, encodeNoticeCursor } from './index';

it('SHOULD round-trip a position', () => {
  const row = { createdAt: new Date('2026-11-23T11:00:04.123Z'), id: 'abc' };

  expect(decodeNoticeCursor(encodeNoticeCursor(row))).toEqual(row);
});

it.each([
  '',
  'not-base64!!',
  Buffer.from('x|y').toString('base64'),
  Buffer.from('2026-11-23T11:00:00Z|').toString('base64'),
  Buffer.from('2026-11-23T11:00:00Z|a|b').toString('base64'),
])('SHOULD reject %j', (cursor) => {
  expect(decodeNoticeCursor(cursor)).toBeUndefined();
});
