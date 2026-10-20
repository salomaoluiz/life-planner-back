import { CreateCreditCardApiSchema, UpdateCreditCardApiSchema } from './credit-card.dto';

const create = {
  brand: 'VISA',
  closingDay: 31,
  color: '#3B5BDB',
  dueDay: 10,
  limit: 500000,
  owner: 'USER',
  ownerId: '6f1c0d7e-0000-4000-8000-000000000003',
  title: 'Main card',
};

describe('CreateCreditCardApiSchema', () => {
  it('SHOULD accept a minimal body AND default the status to ACTIVE', () => {
    expect(CreateCreditCardApiSchema.parse(create).status).toBe('ACTIVE');
  });

  it.each([
    { closingDay: 0 },
    { dueDay: 32 },
    { limit: 0 },
    { lastDigits: '12a4' },
    { ownerId: 'not-a-uuid' },
  ])('SHOULD reject %j', (patch) => {
    expect(CreateCreditCardApiSchema.safeParse({ ...create, ...patch }).success).toBe(false);
  });
});

describe('UpdateCreditCardApiSchema', () => {
  it('SHOULD accept null to clear paymentDay and lastDigits', () => {
    expect(
      UpdateCreditCardApiSchema.safeParse({ lastDigits: null, paymentDay: null }).success,
    ).toBe(true);
  });

  it('SHOULD reject an empty body', () => {
    expect(UpdateCreditCardApiSchema.safeParse({}).success).toBe(false);
  });

  it('SHOULD reject owner without ownerId AND ownerId without owner', () => {
    expect(UpdateCreditCardApiSchema.safeParse({ owner: 'USER' }).success).toBe(false);
    expect(UpdateCreditCardApiSchema.safeParse({ ownerId: create.ownerId }).success).toBe(false);
  });

  it('SHOULD accept owner together with ownerId AND reject unknown keys', () => {
    expect(
      UpdateCreditCardApiSchema.safeParse({ owner: 'USER', ownerId: create.ownerId }).success,
    ).toBe(true);
    expect(UpdateCreditCardApiSchema.safeParse({ extra: 1, title: 'x' }).success).toBe(false);
  });
});

describe('payment account fields (spec 035)', () => {
  it('SHOULD accept a uuid or null on update AND reject a non-uuid', () => {
    expect(
      UpdateCreditCardApiSchema.safeParse({
        paymentAccountId: '3f9e6a3e-8f0c-4a52-9b0e-2f6d1c8f9a11',
      }).success,
    ).toBe(true);
    expect(UpdateCreditCardApiSchema.safeParse({ paymentAccountId: null }).success).toBe(true);
    expect(UpdateCreditCardApiSchema.safeParse({ paymentAccountId: 'x' }).success).toBe(false);
  });
});

describe('currency (spec 040)', () => {
  it('SHOULD default to BRL, accept USD AND reject an unknown code', () => {
    expect(CreateCreditCardApiSchema.parse(create).currency).toBe('BRL');
    expect(CreateCreditCardApiSchema.parse({ ...create, currency: 'USD' }).currency).toBe('USD');
    expect(CreateCreditCardApiSchema.safeParse({ ...create, currency: 'XYZ' }).success).toBe(false);
  });

  it('SHOULD reject currency on PATCH', () => {
    expect(UpdateCreditCardApiSchema.safeParse({ currency: 'BRL' }).success).toBe(false);
  });
});
