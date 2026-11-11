import {
  ApproveEventSuggestionApiSchema,
  CreateFractionSaleApiSchema,
  EventSuggestionListApiSchema,
  EventSuggestionsQuerySchema,
} from './corporate-event.dto';

const id = '1c7b2f8d-4a5e-4c3b-9dae-2f3a4b5c6d7e';

describe('CreateFractionSaleApiSchema', () => {
  const sale = { accountId: id, date: '2026-04-04', grossAmount: 520 };

  it('SHOULD accept the amount with fees AND a zero write-off', () => {
    expect(CreateFractionSaleApiSchema.safeParse(sale).success).toBe(true);
    expect(
      CreateFractionSaleApiSchema.safeParse({
        ...sale,
        fees: [{ amount: 10, kind: 'BROKERAGE' }],
      }).success,
    ).toBe(true);
    expect(
      CreateFractionSaleApiSchema.safeParse({
        date: '2026-04-04',
        generateTransaction: false,
        grossAmount: 0,
      }).success,
    ).toBe(true);
  });

  it.each([{ grossAmount: -1 }, { grossAmount: 1.5 }, { date: '04/04/2026' }, { quantity: '1' }])(
    'SHOULD reject %j',
    (override) => {
      expect(CreateFractionSaleApiSchema.safeParse({ ...sale, ...override }).success).toBe(false);
    },
  );
});

describe('ApproveEventSuggestionApiSchema', () => {
  it('SHOULD accept an empty body AND any override', () => {
    expect(ApproveEventSuggestionApiSchema.safeParse({}).success).toBe(true);
    expect(
      ApproveEventSuggestionApiSchema.safeParse({
        bonusPercent: '5',
        bonusUnitCost: null,
        date: '2026-11-17',
        type: 'BONUS',
      }).success,
    ).toBe(true);
  });

  it.each([{ type: 'BUY' }, { ratioFrom: 1 }, { quantity: '1' }])('SHOULD reject %j', (body) => {
    expect(ApproveEventSuggestionApiSchema.safeParse(body).success).toBe(false);
  });
});

describe('EventSuggestionsQuerySchema', () => {
  it('SHOULD read the page size from the query string', () => {
    expect(EventSuggestionsQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(EventSuggestionsQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
    expect(EventSuggestionsQuerySchema.safeParse({ assetId: 'x' }).success).toBe(false);
  });
});

describe('EventSuggestionListApiSchema', () => {
  it('SHOULD describe the list with its count and cursor', () => {
    expect(
      EventSuggestionListApiSchema.safeParse({
        count: 1,
        items: [
          {
            assetId: id,
            averagePriceAfter: '9.61109827',
            averagePriceBefore: '10.11409524',
            bonusPercent: '10',
            bonusUnitCost: '4.50',
            currency: 'BRL',
            date: '2026-11-18',
            fractionQuantity: '0.5',
            id,
            quantityAfter: '346',
            quantityBefore: '315',
            ticker: 'MGLU3',
            type: 'BONUS',
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });
});
