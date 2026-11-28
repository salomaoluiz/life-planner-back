import {
  decodeActivityCursor,
  decodeItemCursor,
  encodeActivityCursor,
  encodeItemCursor,
} from './index';

describe('activity cursors', () => {
  it('SHOULD round-trip the entry cursor', () => {
    const row = { id: 'id-1', occurredAt: new Date('2026-11-24T14:42:10.000Z') };

    expect(decodeActivityCursor(encodeActivityCursor(row))).toEqual(row);
  });

  it('SHOULD reject a cursor that is not ours', () => {
    expect(decodeActivityCursor('bm90LWE=')).toBeUndefined();
    expect(decodeActivityCursor(Buffer.from('a|b|c').toString('base64'))).toBeUndefined();
  });

  it('SHOULD round-trip the item cursor, with and without a booking date', () => {
    expect(decodeItemCursor(encodeItemCursor({ bookingDate: '2026-10-31', id: 'i' }))).toEqual({
      bookingDate: '2026-10-31',
      id: 'i',
    });
    expect(decodeItemCursor(encodeItemCursor({ bookingDate: null, id: 'i' }))).toEqual({
      bookingDate: null,
      id: 'i',
    });
  });

  it('SHOULD reject a broken item cursor', () => {
    expect(decodeItemCursor(Buffer.from('nope|x').toString('base64'))).toBeUndefined();
  });
});
