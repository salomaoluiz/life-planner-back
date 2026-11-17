import {
  CatalogOwnerQuerySchema,
  CreateStockItemApiSchema,
  CreateStockMovementApiSchema,
  ListStockItemsQuerySchema,
  UpdateStockCategoryApiSchema,
  UpdateStockItemApiSchema,
} from './stock.dto';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const valid = { description: 'Rice', owner: 'USER', ownerId, quantity: 2, unit: 'kilogram' };

describe('CreateStockItemApiSchema', () => {
  it('SHOULD accept the minimal body AND trim text', () => {
    expect(CreateStockItemApiSchema.parse({ ...valid, description: '  Rice ' })).toEqual(valid);
  });

  it('SHOULD accept null optionals (a client echoing a response back), a calendar day AND the new fields', () => {
    expect(
      CreateStockItemApiSchema.safeParse({
        ...valid,
        brand: null,
        categoryId: ownerId,
        expirationDate: '2027-03-01',
        idealQuantity: 1,
        locationId: null,
        minQuantity: 0.3,
        notes: null,
        openedShelfLifeDays: 5,
        quantity: 1.5,
        stockOnly: false,
        warnDaysClosed: 7,
        warnDaysOpened: 1,
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
    ['a missing owner', { owner: undefined }],
    ['a non-uuid ownerId', { ownerId: 'abc' }],
    ['a whitespace description', { description: '   ' }],
    ['a 101-char description', { description: 'a'.repeat(101) }],
    ['a negative quantity', { quantity: -1 }],
    ['a string quantity', { quantity: '2' }],
    ['quantity above 1,000,000', { quantity: 1_000_001 }],
    ['a removed unit', { unit: 'gram' }],
    ['an unknown unit', { unit: 'UNIT' }],
    ['a date-time instead of a day', { purchaseDate: '2026-10-04T00:00:00.000Z' }],
    ['an impossible calendar day', { purchaseDate: '2026-02-30' }],
    ['shelf life 0', { openedShelfLifeDays: 0 }],
    ['shelf life 3651', { openedShelfLifeDays: 3651 }],
    ['warn days 366', { warnDaysClosed: 366 }],
    ['a 101-char brand', { brand: 'a'.repeat(101) }],
    ['a 65-char barcode', { barcode: 'a'.repeat(65) }],
    ['1001-char notes', { notes: 'a'.repeat(1001) }],
  ])('SHOULD reject %s', (_label, patch) => {
    expect(CreateStockItemApiSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('UpdateStockItemApiSchema', () => {
  it('SHOULD accept any subset AND null on optional fields', () => {
    expect(UpdateStockItemApiSchema.parse({ categoryId: null, notes: null })).toEqual({
      categoryId: null,
      notes: null,
    });
    expect(UpdateStockItemApiSchema.safeParse({ owner: 'FAMILY', ownerId }).success).toBe(true);
  });

  it.each([
    ['an empty body', {}],
    ['only owner', { owner: 'FAMILY' }],
    ['only ownerId', { ownerId }],
    ['an unknown key', { foo: 1 }],
    ['quantity (not editable)', { quantity: 1 }],
    ['a lot date (not editable)', { expirationDate: '2026-12-01' }],
    ['id', { id: ownerId }],
    ['null description', { description: null }],
    ['null unit', { unit: null }],
    ['null owner', { owner: null, ownerId }],
    ['a negative minimum', { minQuantity: -1 }],
  ])('SHOULD reject %s', (_label, body) => {
    expect(UpdateStockItemApiSchema.safeParse(body).success).toBe(false);
  });
});

describe('CreateStockMovementApiSchema', () => {
  it('SHOULD accept each type with its own fields', () => {
    expect(
      CreateStockMovementApiSchema.safeParse({ quantity: 1, reason: 'MANUAL', type: 'ENTRY' })
        .success,
    ).toBe(true);
    expect(
      CreateStockMovementApiSchema.safeParse({ lotId: ownerId, quantity: 1, type: 'CONSUME' })
        .success,
    ).toBe(true);
    expect(CreateStockMovementApiSchema.safeParse({ type: 'OPEN' }).success).toBe(true);
    expect(
      CreateStockMovementApiSchema.safeParse({ lotId: ownerId, reason: 'SPOILED', type: 'DISCARD' })
        .success,
    ).toBe(true);
    expect(
      CreateStockMovementApiSchema.safeParse({ countedQuantity: 0, type: 'ADJUST' }).success,
    ).toBe(true);
  });

  it.each([
    ['INITIAL', { quantity: 1, type: 'INITIAL' }],
    ['an ENTRY with EXPIRED reason', { quantity: 1, reason: 'EXPIRED', type: 'ENTRY' }],
    ['a zero consume', { quantity: 0, type: 'CONSUME' }],
    ['a DISCARD without a lot', { reason: 'OTHER', type: 'DISCARD' }],
    ['a 201-char note', { note: 'a'.repeat(201), type: 'OPEN' }],
  ])('SHOULD reject %s', (_label, body) => {
    expect(CreateStockMovementApiSchema.safeParse(body).success).toBe(false);
  });
});

describe('query schemas', () => {
  it('SHOULD turn one filter id into a list', () => {
    expect(ListStockItemsQuerySchema.parse({ categoryId: ownerId })).toEqual({
      categoryId: [ownerId],
    });
    expect(ListStockItemsQuerySchema.parse({})).toEqual({});
  });

  it('SHOULD read includeArchived as a boolean', () => {
    expect(
      CatalogOwnerQuerySchema.parse({ includeArchived: 'true', owner: 'USER', ownerId })
        .includeArchived,
    ).toBe(true);
    expect(CatalogOwnerQuerySchema.parse({ owner: 'USER', ownerId }).includeArchived).toBe(false);
    expect(UpdateStockCategoryApiSchema.safeParse({}).success).toBe(false);
  });
});
