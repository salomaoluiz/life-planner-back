import { FinanceInstallmentPlanMapper } from './index';

describe('FinanceInstallmentPlanMapper.toDomain', () => {
  it('SHOULD map the columns, the calendar date AND the rows', () => {
    const result = FinanceInstallmentPlanMapper.toDomain({
      category_id: 'cat-1',
      created_at: new Date('2026-10-01T00:00:00.000Z'),
      credit_card_id: 'card-1',
      currency: 'BRL' as const,
      date: new Date('2026-10-20T00:00:00.000Z'),
      description: 'Notebook',
      id: 'plan-1',
      installment_count: 10,
      owner: 'USER',
      owner_id: 'owner-1',
      prepayment: null,
      total_value: 512000,
      transactions: [],
      updated_at: new Date('2026-10-02T00:00:00.000Z'),
    });

    expect(result).toEqual(
      expect.objectContaining({
        categoryId: 'cat-1',
        creditCardId: 'card-1',
        date: '2026-10-20',
        installmentCount: 10,
        installments: [],
        owner: 'USER',
        totalValue: 512000,
      }),
    );
  });

  it('SHOULD map the prepayment summary with its discount', () => {
    const result = FinanceInstallmentPlanMapper.toDomain({
      category_id: 'cat-1',
      created_at: new Date('2026-10-01T00:00:00.000Z'),
      credit_card_id: 'card-1',
      currency: 'BRL' as const,
      date: new Date('2026-10-20T00:00:00.000Z'),
      description: 'Notebook',
      id: 'plan-1',
      installment_count: 10,
      owner: 'USER',
      owner_id: 'owner-1',
      prepayment: {
        created_at: new Date('2026-10-16T00:00:00.000Z'),
        date: new Date('2026-10-16T00:00:00.000Z'),
        discount_transaction: { value: 12000 },
        discount_transaction_id: 'discount-1',
        id: 'prepayment-1',
        installment_plan_id: 'plan-1',
        original_months: {},
        owner: 'USER',
        owner_id: 'owner-1',
        target_invoice_month: '2026-10',
        updated_at: new Date('2026-10-16T00:00:00.000Z'),
      },
      total_value: 512000,
      transactions: [],
      updated_at: new Date('2026-10-02T00:00:00.000Z'),
    });

    expect(result.prepayment).toEqual({
      date: '2026-10-16',
      discount: 12000,
      id: 'prepayment-1',
      targetInvoiceMonth: '2026-10',
    });
  });
});
