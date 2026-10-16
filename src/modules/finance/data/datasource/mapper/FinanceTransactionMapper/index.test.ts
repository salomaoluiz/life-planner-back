import { SystemCategoryKey } from '@finance/domain/enum';

import { FinanceTransactionMapper } from './index';
import { mocks } from './index.mocks';

describe('FinanceTransactionMapper.toDomain', () => {
  it('SHOULD map columns, embed the account / category summaries AND turn the date into YYYY-MM-DD', () => {
    expect(FinanceTransactionMapper.toDomain(mocks.raw)).toEqual({
      account: { icon: 'bank', id: mocks.raw.account?.id, name: 'Checking' },
      accountId: mocks.raw.account_id,
      category: {
        excludeFromTotals: false,
        icon: 'cart',
        iconColor: '#2E7D32',
        id: mocks.raw.category.id,
        name: 'Groceries',
        systemKey: null,
      },
      categoryId: mocks.raw.category_id,
      createdAt: mocks.raw.created_at,
      creditCard: null,
      creditCardId: null,
      date: '2026-10-03',
      description: 'Weekly groceries',
      id: mocks.raw.id,
      installmentCount: null,
      installmentNumber: null,
      installmentPlanId: null,
      invoiceMonth: null,
      owner: 'FAMILY',
      ownerId: mocks.raw.owner_id,
      type: 'EXPENSE',
      updatedAt: mocks.raw.updated_at,
      value: 23490,
    });
  });

  it('SHOULD keep the same calendar day for a date stored at the very end of the UTC day', () => {
    const raw = { ...mocks.raw, date: new Date('2026-10-03T23:59:59.999Z') };

    expect(FinanceTransactionMapper.toDomain(raw).date).toBe('2026-10-03');
  });
});

it('SHOULD map a system category: its key as the enum AND excludeFromTotals', () => {
  const result = FinanceTransactionMapper.toDomain({
    ...mocks.raw,
    category: {
      ...mocks.raw.category,
      exclude_from_totals: true,
      name: 'Balance adjustment',
      system_key: 'BALANCE_ADJUSTMENT',
    },
  });

  expect(result.category.systemKey).toBe(SystemCategoryKey.BALANCE_ADJUSTMENT);
  expect(result.category.excludeFromTotals).toBe(true);
});

describe('FinanceTransactionMapper.toDomain (card purchase)', () => {
  it('SHOULD map a card purchase with a null account', () => {
    const result = FinanceTransactionMapper.toDomain({
      ...mocks.raw,
      account: null,
      account_id: null,
      credit_card: { color: '#2B3A8C', id: 'card-1', last_digits: '1234', title: 'Main card' },
      credit_card_id: 'card-1',
      invoice_month: '2026-10',
    });

    expect(result.account).toBeNull();
    expect(result.accountId).toBeNull();
    expect(result.creditCard).toEqual({
      color: '#2B3A8C',
      id: 'card-1',
      lastDigits: '1234',
      title: 'Main card',
    });
    expect(result.invoiceMonth).toBe('2026-10');
  });
});

it('SHOULD map the installment columns AND the plan count', () => {
  const result = FinanceTransactionMapper.toDomain({
    ...mocks.raw,
    installment_number: 3,
    installment_plan: { installment_count: 10 },
    installment_plan_id: 'plan-1',
  });

  expect(result.installmentCount).toBe(10);
  expect(result.installmentNumber).toBe(3);
  expect(result.installmentPlanId).toBe('plan-1');
});
