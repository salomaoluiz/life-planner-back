import { FinanceInstallmentPlanMapper } from './index';

describe('FinanceInstallmentPlanMapper.toDomain', () => {
  it('SHOULD map the columns, the calendar date AND the rows', () => {
    const result = FinanceInstallmentPlanMapper.toDomain({
      category_id: 'cat-1',
      created_at: new Date('2026-10-01T00:00:00.000Z'),
      credit_card_id: 'card-1',
      date: new Date('2026-10-20T00:00:00.000Z'),
      description: 'Notebook',
      id: 'plan-1',
      installment_count: 10,
      owner: 'USER',
      owner_id: 'owner-1',
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
});
