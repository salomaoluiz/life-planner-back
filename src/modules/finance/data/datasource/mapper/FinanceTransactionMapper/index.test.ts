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
      currency: 'BRL' as const,
      date: '2026-10-03',
      description: 'Weekly groceries',
      earlyPayment: null,
      id: mocks.raw.id,
      installmentCount: null,
      installmentNumber: null,
      installmentPlanId: null,
      invoiceMonth: null,
      occurrenceCount: null,
      occurrenceNumber: null,
      owner: 'FAMILY',
      ownerId: mocks.raw.owner_id,
      paid: true,
      paidFromAccountId: null,
      paidFromAccountName: null,
      paidFromTransactionId: null,
      paymentMethod: null,
      prepaymentId: null,
      recurrenceFrequency: null,
      recurrenceId: null,
      refundedName: null,
      refundedPlanId: null,
      refundedTransactionId: null,
      tags: [],
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

it('SHOULD map the credit columns: refunded name, payment method and the debit account', () => {
  const result = FinanceTransactionMapper.toDomain({
    ...mocks.raw,
    paid_from_transaction: { account: { name: 'Checking' }, account_id: 'account-1' },
    paid_from_transaction_id: 'debit-1',
    payment_method: 'ACCOUNT',
    prepayment_id: 'prepayment-1',
    refunded_plan: { description: 'Notebook' },
    refunded_plan_id: 'plan-1',
  });

  expect(result).toMatchObject({
    paidFromAccountId: 'account-1',
    paidFromAccountName: 'Checking',
    paidFromTransactionId: 'debit-1',
    paymentMethod: 'ACCOUNT',
    prepaymentId: 'prepayment-1',
    refundedName: 'Notebook',
    refundedPlanId: 'plan-1',
  });
});

it('SHOULD map the early payment an account debit row belongs to', () => {
  const result = FinanceTransactionMapper.toDomain({
    ...mocks.raw,
    early_payment: { credit_card_id: 'card-1', id: 'early-1', invoice_month: '2026-10' },
  });

  expect(result.earlyPayment).toEqual({
    creditCardId: 'card-1',
    id: 'early-1',
    invoiceMonth: '2026-10',
  });
});

describe('FinanceTransactionMapper paid', () => {
  it('SHOULD map a NULL paid (card row) to false', () => {
    expect(FinanceTransactionMapper.toDomain({ ...mocks.raw, paid: null }).paid).toBe(false);
  });
});

describe('FinanceTransactionMapper.toDomain recurrence', () => {
  it('SHOULD expose the series position, frequency AND the total when the series has an end date', () => {
    const recurrenceId = 'recurrence-id';
    const raw = {
      ...mocks.raw,
      occurrence_number: 3,
      recurrence: {
        end_date: new Date('2027-09-05T00:00:00.000Z'),
        first_number: 1,
        frequency: 'MONTHLY' as const,
        start_date: new Date('2026-10-05T00:00:00.000Z'),
      },
      recurrence_id: recurrenceId,
    };

    expect(FinanceTransactionMapper.toDomain(raw)).toMatchObject({
      occurrenceCount: 12,
      occurrenceNumber: 3,
      recurrenceFrequency: 'MONTHLY',
      recurrenceId,
    });
  });

  it('SHOULD leave the total null when the series has no end date', () => {
    const raw = {
      ...mocks.raw,
      occurrence_number: 1,
      recurrence: {
        end_date: null,
        first_number: 1,
        frequency: 'WEEKLY' as const,
        start_date: new Date('2026-10-05T00:00:00.000Z'),
      },
      recurrence_id: 'recurrence-id',
    };

    expect(FinanceTransactionMapper.toDomain(raw).occurrenceCount).toBeNull();
  });
});
