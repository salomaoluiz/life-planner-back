import {
  AssetDetailApiSchema,
  CreateAssetApiSchema,
  CreateOperationApiSchema,
  UpdateAssetApiSchema,
  UpdateOperationApiSchema,
} from './investment.dto';

const ownerId = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';

describe('CreateAssetApiSchema', () => {
  const base = { assetClass: 'BR_STOCK', name: 'Itausa', owner: 'USER', ownerId };

  it('SHOULD accept the minimum body AND a current unit price string', () => {
    expect(CreateAssetApiSchema.safeParse(base).success).toBe(true);
    expect(CreateAssetApiSchema.safeParse({ ...base, currentUnitPrice: '10.53' }).success).toBe(
      true,
    );
  });

  it.each([{ currentUnitPrice: 10.53 }, { currency: 'JPY' }, { owner: 'X' }, { extra: true }])(
    'SHOULD reject %j',
    (override) => {
      expect(CreateAssetApiSchema.safeParse({ ...base, ...override }).success).toBe(false);
    },
  );
});

describe('UpdateAssetApiSchema', () => {
  it('SHOULD allow any subset AND null ticker', () => {
    expect(UpdateAssetApiSchema.safeParse({ ticker: null }).success).toBe(true);
    expect(UpdateAssetApiSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(true);
    expect(UpdateAssetApiSchema.safeParse({ status: 'GONE' }).success).toBe(false);
  });
});

describe('operation schemas', () => {
  const base = { date: '2026-06-10', quantity: '500', type: 'BUY', unitPrice: '10.20' };

  it('SHOULD accept decimal strings and up to 10 fees', () => {
    expect(CreateOperationApiSchema.safeParse(base).success).toBe(true);
    expect(
      CreateOperationApiSchema.safeParse({
        ...base,
        fees: Array.from({ length: 10 }, () => ({ amount: 1, kind: 'BROKERAGE' })),
      }).success,
    ).toBe(true);
    expect(
      CreateOperationApiSchema.safeParse({
        ...base,
        fees: Array.from({ length: 11 }, () => ({ amount: 1, kind: 'BROKERAGE' })),
      }).success,
    ).toBe(false);
  });

  it.each([{ quantity: 500 }, { quantity: '1e3' }, { unitPrice: '-1' }, { date: '10/06/2026' }])(
    'SHOULD reject %j',
    (override) => {
      expect(CreateOperationApiSchema.safeParse({ ...base, ...override }).success).toBe(false);
    },
  );

  it('SHOULD not let an update change the type or the asset', () => {
    expect(UpdateOperationApiSchema.safeParse({ accountId: null, quantity: '1' }).success).toBe(
      true,
    );
    expect(UpdateOperationApiSchema.safeParse({ type: 'SELL' }).success).toBe(false);
    expect(UpdateOperationApiSchema.safeParse({ assetId: ownerId }).success).toBe(false);
  });
});

describe('AssetDetailApiSchema', () => {
  it('SHOULD require the operations and valuations lists', () => {
    expect(AssetDetailApiSchema.safeParse({ item: {} }).success).toBe(false);
  });
});
