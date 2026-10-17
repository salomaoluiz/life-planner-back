import {
  CreateEarlyPaymentApiSchema,
  CreateRefundApiSchema,
  EarlyPaymentApiSchema,
  RefundApiSchema,
  UpdateEarlyPaymentApiSchema,
  UpdateRefundApiSchema,
} from './card-credit.dto';

const uuid = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const refund = {
  date: '2026-10-16',
  description: 'Refund · Notebook',
  invoiceMonth: '2026-10',
  value: 50000,
};
const early = {
  accountId: uuid,
  date: '2026-10-16',
  description: 'Early payment',
  invoiceMonth: '2026-10',
  method: 'ACCOUNT',
  today: '2026-10-16',
  value: 60000,
};

describe('CreateRefundApiSchema', () => {
  it('SHOULD accept a standalone refund AND one linked to a purchase or plan', () => {
    expect(CreateRefundApiSchema.safeParse(refund).success).toBe(true);
    expect(
      CreateRefundApiSchema.safeParse({ ...refund, refundedTransactionId: uuid }).success,
    ).toBe(true);
    expect(CreateRefundApiSchema.safeParse({ ...refund, refundedPlanId: uuid }).success).toBe(true);
  });

  it.each([
    { value: 0 },
    { value: 1.5 },
    { invoiceMonth: '2026-13' },
    { description: '' },
    { refundedPlanId: 'not-a-uuid' },
    { extra: true },
  ])('SHOULD reject %p', (patch) => {
    expect(CreateRefundApiSchema.safeParse({ ...refund, ...patch }).success).toBe(false);
  });
});

describe('UpdateRefundApiSchema', () => {
  it('SHOULD accept a partial body AND a null link, but not an empty or today-only body', () => {
    expect(UpdateRefundApiSchema.safeParse({ description: 'x' }).success).toBe(true);
    expect(UpdateRefundApiSchema.safeParse({ refundedTransactionId: null }).success).toBe(true);
    expect(UpdateRefundApiSchema.safeParse({}).success).toBe(false);
    expect(UpdateRefundApiSchema.safeParse({ today: '2026-10-16' }).success).toBe(false);
  });
});

describe('CreateEarlyPaymentApiSchema', () => {
  it('SHOULD accept the spec example AND a boleto without account', () => {
    expect(CreateEarlyPaymentApiSchema.safeParse(early).success).toBe(true);
    expect(
      CreateEarlyPaymentApiSchema.safeParse({ ...early, accountId: undefined, method: 'EXTERNAL' })
        .success,
    ).toBe(true);
  });

  it('SHOULD reject an account without accountId AND a boleto with one', () => {
    expect(CreateEarlyPaymentApiSchema.safeParse({ ...early, accountId: undefined }).success).toBe(
      false,
    );
    expect(CreateEarlyPaymentApiSchema.safeParse({ ...early, method: 'EXTERNAL' }).success).toBe(
      false,
    );
    expect(CreateEarlyPaymentApiSchema.safeParse({ ...early, value: 0 }).success).toBe(false);
  });
});

describe('UpdateEarlyPaymentApiSchema', () => {
  it('SHOULD accept any subset but not an empty body', () => {
    expect(UpdateEarlyPaymentApiSchema.safeParse({ value: 5 }).success).toBe(true);
    expect(UpdateEarlyPaymentApiSchema.safeParse({ method: 'EXTERNAL' }).success).toBe(true);
    expect(UpdateEarlyPaymentApiSchema.safeParse({}).success).toBe(false);
  });
});

describe('outputs', () => {
  it('SHOULD describe a refund and an early payment', () => {
    expect(
      RefundApiSchema.safeParse({
        ...refund,
        creditCardId: uuid,
        id: uuid,
        refundedPlanId: null,
        refundedTransactionId: null,
      }).success,
    ).toBe(true);
    expect(
      EarlyPaymentApiSchema.safeParse({
        ...refund,
        id: uuid,
        method: 'EXTERNAL',
      }).success,
    ).toBe(true);
  });
});
