import {
  CreateRecurrenceApiSchema,
  DeleteOccurrenceQuerySchema,
  MaterializeOccurrenceApiSchema,
  ProjectionsQuerySchema,
  SplitRecurrenceApiSchema,
  UpdateRecurrenceApiSchema,
} from '@api/finance/v1/dto/recurrence.dto';

const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const base = {
  accountId: id,
  categoryId: id,
  date: '2026-10-05',
  description: 'Rent',
  frequency: 'MONTHLY',
  owner: 'USER',
  ownerId: id,
  type: 'EXPENSE',
  value: 200000,
};

describe('CreateRecurrenceApiSchema', () => {
  it('SHOULD accept an account series with an end date AND a paid flag', () => {
    expect(
      CreateRecurrenceApiSchema.safeParse({ ...base, endDate: '2027-09-05', paid: true }).success,
    ).toBe(true);
  });

  it('SHOULD accept a card series', () => {
    expect(
      CreateRecurrenceApiSchema.safeParse({ ...base, accountId: undefined, creditCardId: id })
        .success,
    ).toBe(true);
  });

  it.each([
    ['both sources', { creditCardId: id }],
    ['an unknown frequency', { frequency: 'DAILY' }],
    ['an end date before the first date', { endDate: '2026-10-04' }],
    ['a zero value', { value: 0 }],
    ['an unknown field (installments)', { installments: 3 }],
  ])('SHOULD reject %s', (_label, patch) => {
    expect(CreateRecurrenceApiSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it('SHOULD reject neither source', () => {
    expect(CreateRecurrenceApiSchema.safeParse({ ...base, accountId: undefined }).success).toBe(
      false,
    );
  });
});

describe('UpdateRecurrenceApiSchema', () => {
  it('SHOULD accept null to remove the end date', () => {
    expect(UpdateRecurrenceApiSchema.safeParse({ endDate: null }).success).toBe(true);
  });

  it.each([[{}], [{ owner: 'USER' }], [{ type: 'INCOME' }], [{ frequency: 'WEEKLY' }]])(
    'SHOULD reject %j',
    (body) => {
      expect(UpdateRecurrenceApiSchema.safeParse(body).success).toBe(false);
    },
  );
});

describe('SplitRecurrenceApiSchema', () => {
  it('SHOULD require the occurrence number AND accept a frequency change', () => {
    expect(
      SplitRecurrenceApiSchema.safeParse({ frequency: 'WEEKLY', occurrenceNumber: 5 }).success,
    ).toBe(true);
    expect(SplitRecurrenceApiSchema.safeParse({ frequency: 'WEEKLY' }).success).toBe(false);
  });

  it('SHOULD reject both sources, a zero number AND an unknown field', () => {
    expect(
      SplitRecurrenceApiSchema.safeParse({ accountId: id, creditCardId: id, occurrenceNumber: 5 })
        .success,
    ).toBe(false);
    expect(SplitRecurrenceApiSchema.safeParse({ occurrenceNumber: 0 }).success).toBe(false);
    expect(
      SplitRecurrenceApiSchema.safeParse({ occurrenceNumber: 1, type: 'INCOME' }).success,
    ).toBe(false);
  });
});

describe('MaterializeOccurrenceApiSchema', () => {
  it('SHOULD accept the single-occurrence edit fields (scope ONLY_THIS only)', () => {
    expect(
      MaterializeOccurrenceApiSchema.safeParse({ paid: false, scope: 'ONLY_THIS', value: 5 })
        .success,
    ).toBe(true);
    expect(MaterializeOccurrenceApiSchema.safeParse({ scope: 'THIS_AND_NEXT' }).success).toBe(
      false,
    );
    expect(MaterializeOccurrenceApiSchema.safeParse({ accountId: id }).success).toBe(false);
  });
});

describe('query schemas', () => {
  it('SHOULD parse confirmPaid from the query string', () => {
    expect(DeleteOccurrenceQuerySchema.parse({ confirmPaid: 'true', scope: 'ONLY_THIS' })).toEqual({
      confirmPaid: true,
      scope: 'ONLY_THIS',
    });
    expect(DeleteOccurrenceQuerySchema.safeParse({ scope: 'ALL' }).success).toBe(false);
    expect(
      DeleteOccurrenceQuerySchema.safeParse({ confirmPaid: 'yes', scope: 'ONLY_THIS' }).success,
    ).toBe(false);
  });

  it('SHOULD require from and to as YYYY-MM', () => {
    expect(ProjectionsQuerySchema.safeParse({ from: '2026-11', to: '2027-03' }).success).toBe(true);
    expect(ProjectionsQuerySchema.safeParse({ from: '2026-13', to: '2027-03' }).success).toBe(
      false,
    );
    expect(ProjectionsQuerySchema.safeParse({ from: '2026-11' }).success).toBe(false);
  });
});
