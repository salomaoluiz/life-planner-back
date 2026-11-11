import {
  AssetDetailApiSchema,
  CreateAssetApiSchema,
  CreateOperationApiSchema,
  OperationApiSchema,
  PositionApiSchema,
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

describe('corporate events on the operation schemas (spec 108)', () => {
  const event = { date: '2026-03-10', ratioFrom: '1', ratioTo: '4', type: 'SPLIT' };

  it('SHOULD accept an event body on create', () => {
    expect(CreateOperationApiSchema.safeParse(event).success).toBe(true);
    expect(
      CreateOperationApiSchema.safeParse({
        bonusPercent: '10',
        bonusUnitCost: '4.50',
        date: '2026-11-18',
        type: 'BONUS',
      }).success,
    ).toBe(true);
    expect(
      CreateOperationApiSchema.safeParse({
        ...event,
        ratioFrom: '10',
        ratioTo: '1',
        type: 'REVERSE_SPLIT',
      }).success,
    ).toBe(true);
  });

  it.each([
    { quantity: '10' },
    { unitPrice: '1' },
    { fees: [] },
    { accountId: ownerId },
    { generateTransaction: true },
    { ratioTo: 4 },
    { ratioFrom: '1e3' },
  ])('SHOULD reject %j on an event', (override) => {
    expect(CreateOperationApiSchema.safeParse({ ...event, ...override }).success).toBe(false);
  });

  it('SHOULD keep refusing event fields on a buy or a sell', () => {
    expect(
      CreateOperationApiSchema.safeParse({
        date: '2026-06-10',
        quantity: '1',
        ratioFrom: '1',
        type: 'BUY',
        unitPrice: '1',
      }).success,
    ).toBe(false);
  });

  it('SHOULD let an update change the fields of an event AND the amount of a fraction sale', () => {
    for (const body of [
      { ratioFrom: '20' },
      { bonusPercent: '5' },
      { bonusUnitCost: null },
      { grossAmount: 600 },
      { generateTransaction: false, grossAmount: 0 },
    ]) {
      expect(UpdateOperationApiSchema.safeParse(body).success).toBe(true);
    }
    expect(UpdateOperationApiSchema.safeParse({ grossAmount: 1.5 }).success).toBe(false);
  });

  it('SHOULD describe an event without the buy and sell fields', () => {
    expect(
      OperationApiSchema.safeParse({
        averagePriceAfter: '10.11409524',
        averagePriceBefore: '1.01141046',
        costRemoved: null,
        date: '2026-03-10',
        fees: [],
        fractionCost: 506,
        fractionQuantity: '0.5',
        id: ownerId,
        quantityAfter: '315',
        quantityBefore: '3155',
        ratioFrom: '10',
        ratioTo: '1',
        realizedResult: null,
        type: 'REVERSE_SPLIT',
      }).success,
    ).toBe(true);
  });

  it('SHOULD list the pending fractions in the position', () => {
    const position = {
      averagePrice: '10.11409524',
      cost: 318594,
      currentUnitPrice: null,
      currentValue: null,
      currentValueDate: null,
      openResult: null,
      openResultPercent: null,
      pendingFractions: [{ cost: 506, date: '2026-03-10', eventId: ownerId, quantity: '0.5' }],
      quantity: '315',
      realizedResult: 0,
    };

    expect(PositionApiSchema.safeParse(position).success).toBe(true);
    expect(PositionApiSchema.safeParse({ ...position, pendingFractions: undefined }).success).toBe(
      false,
    );
  });
});
