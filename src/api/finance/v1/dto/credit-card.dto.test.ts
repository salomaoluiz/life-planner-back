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
