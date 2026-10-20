import {
  CreateInstallmentPlanApiSchema,
  InstallmentPlanApiSchema,
  PrepayInstallmentPlanApiSchema,
  UpdateInstallmentPlanApiSchema,
} from './installment-plan.dto';

const uuid = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const valid = {
  categoryId: uuid,
  creditCardId: uuid,
  date: '2026-10-20',
  description: 'Notebook',
  installments: 10,
  owner: 'USER',
  ownerId: uuid,
  value: 512000,
};

describe('CreateInstallmentPlanApiSchema', () => {
  it('SHOULD accept the spec example, the bounds AND an optional today', () => {
    expect(
      CreateInstallmentPlanApiSchema.safeParse({ ...valid, today: '2026-10-16' }).success,
    ).toBe(true);
    expect(CreateInstallmentPlanApiSchema.safeParse({ ...valid, installments: 2 }).success).toBe(
      true,
    );
    expect(CreateInstallmentPlanApiSchema.safeParse({ ...valid, installments: 48 }).success).toBe(
      true,
    );
  });

  it.each([1, 49, 2.5, '10'])('SHOULD reject installments %p', (installments) => {
    expect(CreateInstallmentPlanApiSchema.safeParse({ ...valid, installments }).success).toBe(
      false,
    );
  });

  it('SHOULD reject a total below one cent per installment', () => {
    expect(CreateInstallmentPlanApiSchema.safeParse({ ...valid, value: 9 }).success).toBe(false);
    expect(CreateInstallmentPlanApiSchema.safeParse({ ...valid, value: 10 }).success).toBe(true);
  });
});

describe('UpdateInstallmentPlanApiSchema', () => {
  it('SHOULD accept any subset AND reject empty bodies or unknown keys', () => {
    expect(UpdateInstallmentPlanApiSchema.safeParse({ description: 'x' }).success).toBe(true);
    expect(UpdateInstallmentPlanApiSchema.safeParse({ installments: 12, value: 100 }).success).toBe(
      true,
    );
    expect(UpdateInstallmentPlanApiSchema.safeParse({}).success).toBe(false);
    expect(UpdateInstallmentPlanApiSchema.safeParse({ owner: 'USER' }).success).toBe(false);
  });
});

describe('InstallmentPlanApiSchema', () => {
  it('SHOULD describe the plan, its installments AND the optional overLimit', () => {
    const output = {
      installments: [
        {
          id: uuid,
          installmentNumber: 1,
          invoiceMonth: '2026-10',
          invoiceStatus: 'OPEN',
          prepaid: false,
          value: 5,
        },
      ],
      plan: {
        categoryId: uuid,
        creditCardId: uuid,
        currency: 'BRL',
        date: '2026-10-20',
        description: 'Notebook',
        id: uuid,
        installmentCount: 1,
        owner: 'USER',
        ownerId: uuid,
        prepayment: null,
        totalValue: 5,
      },
    };

    expect(InstallmentPlanApiSchema.safeParse(output).success).toBe(true);
    expect(InstallmentPlanApiSchema.safeParse({ ...output, overLimit: true }).success).toBe(true);
  });
});

describe('PrepayInstallmentPlanApiSchema', () => {
  it('SHOULD accept the spec example, with or without a discount', () => {
    const body = { date: '2026-10-16', targetInvoiceMonth: '2026-10' };

    expect(PrepayInstallmentPlanApiSchema.safeParse({ ...body, discount: 12000 }).success).toBe(
      true,
    );
    expect(PrepayInstallmentPlanApiSchema.safeParse({ ...body, discount: 0 }).success).toBe(true);
    expect(PrepayInstallmentPlanApiSchema.safeParse(body).success).toBe(true);
  });

  it('SHOULD reject a negative discount, a bad month AND unknown keys', () => {
    const body = { date: '2026-10-16', targetInvoiceMonth: '2026-10' };

    expect(PrepayInstallmentPlanApiSchema.safeParse({ ...body, discount: -1 }).success).toBe(false);
    expect(
      PrepayInstallmentPlanApiSchema.safeParse({ ...body, targetInvoiceMonth: '2026-13' }).success,
    ).toBe(false);
    expect(PrepayInstallmentPlanApiSchema.safeParse({ ...body, extra: 1 }).success).toBe(false);
  });
});
