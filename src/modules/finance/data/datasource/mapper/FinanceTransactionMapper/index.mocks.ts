import { faker } from '@faker-js/faker';

import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';

// region Mocks

const rawTransactionMock: FinancialTransactionWithRelations = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  account_id: faker.string.uuid(),
  category: {
    exclude_from_totals: false,
    icon: 'cart',
    icon_color: '#2E7D32',
    id: faker.string.uuid(),
    name: 'Groceries',
    system_key: null,
  },
  category_id: faker.string.uuid(),
  created_at: faker.date.past(),
  credit_card: null,
  credit_card_id: null,
  currency: 'BRL' as const,
  date: new Date('2026-10-03T00:00:00.000Z'),
  description: 'Weekly groceries',
  early_payment: null,
  id: faker.string.uuid(),
  installment_number: null,
  installment_plan: null,
  installment_plan_id: null,
  invoice_month: null,
  notes: null,
  occurrence_number: null,
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  paid: true,
  paid_from_transaction: null,
  paid_from_transaction_id: null,
  payment_method: null,
  prepayment_id: null,
  recurrence: null,
  recurrence_id: null,
  refunded_plan: null,
  refunded_plan_id: null,
  refunded_transaction: null,
  refunded_transaction_id: null,
  type: 'EXPENSE',
  updated_at: faker.date.recent(),
  value: 23490,
};

// endregion Mocks

export const mocks = { raw: rawTransactionMock };
