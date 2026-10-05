import { CreateStockItemApiSchema, UpdateStockItemApiSchema } from './stock.dto';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const valid = { description: 'Rice', owner: 'USER', ownerId, quantity: 2, unit: 'kilogram' };

describe('CreateStockItemApiSchema', () => {
  it('SHOULD accept the minimal body AND trim text', () => {
    expect(CreateStockItemApiSchema.parse({ ...valid, description: '  Rice ' })).toEqual(valid);
  });

  it('SHOULD accept null optionals (a client echoing a response back) AND offset date-times', () => {
    expect(
      CreateStockItemApiSchema.safeParse({
        ...valid,
        brand: null,
        expirationDate: '2027-03-01T00:00:00-03:00',
        notes: null,
      }).success,
    ).toBe(true);
  });

  it('SHOULD accept the quantity bounds', () => {
    expect(CreateStockItemApiSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(true);
    expect(CreateStockItemApiSchema.safeParse({ ...valid, quantity: 1_000_000 }).success).toBe(
      true,
    );
  });

  it.each([
    ['an unknown field', { foo: 1 }],
    ['id', { id: ownerId }],
    ['createdAt', { createdAt: '2026-10-04T12:00:00.000Z' }],
    ['updatedAt', { updatedAt: '2026-10-04T12:00:00.000Z' }],
    ['a missing owner', { owner: undefined }],
    ['a non-uuid ownerId', { ownerId: 'abc' }],
    ['a whitespace description', { description: '   ' }],
    ['a 201-char description', { description: 'a'.repeat(201) }],
    ['a negative quantity', { quantity: -1 }],
    ['a fractional quantity', { quantity: 1.5 }],
    ['a string quantity', { quantity: '2' }],
    ['quantity above 1,000,000', { quantity: 1_000_001 }],
    ['an unknown unit', { unit: 'UNIT' }],
    ['a date without time', { purchaseDate: '2026-10-04' }],
    ['an impossible calendar date', { purchaseDate: '2026-02-30T00:00:00.000Z' }],
    ['a 101-char brand', { brand: 'a'.repeat(101) }],
    ['a 65-char barcode', { barcode: 'a'.repeat(65) }],
    ['1001-char notes', { notes: 'a'.repeat(1001) }],
  ])('SHOULD reject %s', (_label, patch) => {
    expect(CreateStockItemApiSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('UpdateStockItemApiSchema', () => {
  it('SHOULD accept any subset AND null on optional fields', () => {
    expect(UpdateStockItemApiSchema.parse({ notes: null, quantity: 1 })).toEqual({
      notes: null,
      quantity: 1,
    });
    expect(UpdateStockItemApiSchema.safeParse({ owner: 'FAMILY', ownerId }).success).toBe(true);
  });

  it.each([
    ['an empty body', {}],
    ['only owner', { owner: 'FAMILY' }],
    ['only ownerId', { ownerId }],
    ['an unknown key', { foo: 1 }],
    ['id', { id: ownerId }],
    ['null description', { description: null }],
    ['null quantity', { quantity: null }],
    ['null unit', { unit: null }],
    ['null owner', { owner: null, ownerId }],
    ['a negative quantity', { quantity: -1 }],
    ['an invalid date', { openingDate: 'yesterday' }],
  ])('SHOULD reject %s', (_label, body) => {
    expect(UpdateStockItemApiSchema.safeParse(body).success).toBe(false);
  });
});
