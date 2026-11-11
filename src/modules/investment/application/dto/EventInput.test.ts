import {
  ApproveEventSuggestionSchema,
  CreateEventSchema,
  CreateFractionSaleSchema,
} from './EventInput';

const base = { accessibleOwners: [], assetId: 'asset-1', date: '2026-03-10' };

function messages(input: object): string[] {
  const result = parse(input);

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}
function parse(input: object) {
  return CreateEventSchema.safeParse({ ...base, ...input });
}

describe('CreateEventSchema', () => {
  it('SHOULD accept a split, a reverse split and a bonus', () => {
    expect(parse({ ratioFrom: '1', ratioTo: '4', type: 'SPLIT' }).success).toBe(true);
    expect(parse({ ratioFrom: '10', ratioTo: '1', type: 'REVERSE_SPLIT' }).success).toBe(true);
    expect(parse({ bonusPercent: '10', bonusUnitCost: '4.50', type: 'BONUS' }).success).toBe(true);
    expect(parse({ bonusPercent: '10', type: 'BONUS' }).success).toBe(true);
  });

  it('SHOULD require the ratio in the right direction', () => {
    expect(messages({ ratioFrom: '4', ratioTo: '1', type: 'SPLIT' })).toContain(
      'A split needs ratioTo greater than ratioFrom',
    );
    expect(messages({ ratioFrom: '1', ratioTo: '4', type: 'REVERSE_SPLIT' })).toContain(
      'A reverse split needs ratioTo smaller than ratioFrom',
    );
    expect(messages({ ratioFrom: '1', ratioTo: '1', type: 'SPLIT' })).not.toEqual([]);
    expect(messages({ type: 'SPLIT' })).not.toEqual([]);
  });

  it('SHOULD bound the ratio and the bonus percent', () => {
    expect(parse({ ratioFrom: '1', ratioTo: '1000001', type: 'SPLIT' }).success).toBe(false);
    expect(parse({ ratioFrom: '1', ratioTo: '1000000', type: 'SPLIT' }).success).toBe(true);
    expect(parse({ bonusPercent: '1000.00000001', type: 'BONUS' }).success).toBe(false);
    expect(parse({ bonusPercent: '0', type: 'BONUS' }).success).toBe(false);
    expect(parse({ ratioFrom: '1', ratioTo: '2.123456789', type: 'SPLIT' }).success).toBe(false);
  });

  it('SHOULD refuse the fields of the other kind of event', () => {
    expect(
      messages({ bonusPercent: '10', ratioFrom: '1', ratioTo: '2', type: 'SPLIT' }),
    ).not.toEqual([]);
    expect(messages({ bonusPercent: '10', ratioFrom: '1', type: 'BONUS' })).not.toEqual([]);
    expect(messages({ bonusPercent: '10', bonusUnitCost: '1', type: 'SPLIT' })).not.toEqual([]);
  });

  it('SHOULD refuse BUY and SELL fields AND a finance entry on an event', () => {
    for (const extra of [
      { quantity: '10' },
      { unitPrice: '1' },
      { fees: [] },
      { accountId: 'acc' },
      { generateTransaction: true },
    ]) {
      expect(parse({ ratioFrom: '1', ratioTo: '4', type: 'SPLIT', ...extra }).success).toBe(false);
    }
    expect(
      parse({ generateTransaction: false, ratioFrom: '1', ratioTo: '4', type: 'SPLIT' }).success,
    ).toBe(true);
  });

  it('SHOULD refuse BUY and SELL as an event type AND a future date', () => {
    expect(parse({ ratioFrom: '1', ratioTo: '4', type: 'BUY' }).success).toBe(false);
    expect(parse({ date: '2999-01-01', ratioFrom: '1', ratioTo: '4', type: 'SPLIT' }).success).toBe(
      false,
    );
  });

  it('SHOULD parse the numbers as exact decimals', () => {
    const result = parse({ bonusPercent: '10', bonusUnitCost: '4.50', type: 'BONUS' });

    expect(result.success && result.data.bonusUnitCost?.toString()).toBe('4.5');
    expect(result.success && result.data.bonusPercent?.toString()).toBe('10');
  });
});

describe('CreateFractionSaleSchema', () => {
  const sale = {
    accessibleOwners: [],
    accountId: 'acc',
    date: '2026-04-04',
    eventId: 'event-1',
    grossAmount: 520,
  };

  it('SHOULD accept a sale with a finance entry', () => {
    expect(CreateFractionSaleSchema.safeParse(sale).success).toBe(true);
  });

  it('SHOULD need the account exactly when it generates a finance entry', () => {
    expect(CreateFractionSaleSchema.safeParse({ ...sale, accountId: undefined }).success).toBe(
      false,
    );
    expect(
      CreateFractionSaleSchema.safeParse({ ...sale, generateTransaction: false }).success,
    ).toBe(false);
    expect(
      CreateFractionSaleSchema.safeParse({
        ...sale,
        accountId: undefined,
        generateTransaction: false,
      }).success,
    ).toBe(true);
  });

  it('SHOULD allow a zero amount only without a finance entry', () => {
    expect(CreateFractionSaleSchema.safeParse({ ...sale, grossAmount: 0 }).success).toBe(false);
    expect(
      CreateFractionSaleSchema.safeParse({
        ...sale,
        accountId: undefined,
        generateTransaction: false,
        grossAmount: 0,
      }).success,
    ).toBe(true);
    expect(CreateFractionSaleSchema.safeParse({ ...sale, grossAmount: -1 }).success).toBe(false);
  });
});

describe('ApproveEventSuggestionSchema', () => {
  it('SHOULD accept an empty body (approve as suggested) AND any override', () => {
    const input = { accessibleOwners: [], id: 'sug-1', userId: 'user-1' };

    expect(ApproveEventSuggestionSchema.safeParse(input).success).toBe(true);
    expect(
      ApproveEventSuggestionSchema.safeParse({ ...input, bonusPercent: '5', type: 'BONUS' })
        .success,
    ).toBe(true);
    expect(ApproveEventSuggestionSchema.safeParse({ ...input, type: 'BUY' }).success).toBe(false);
  });
});
