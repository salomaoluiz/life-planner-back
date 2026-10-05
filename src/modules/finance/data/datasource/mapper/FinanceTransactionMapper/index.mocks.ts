import { faker } from '@faker-js/faker';

import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';

// region Mocks

const rawTransactionMock: FinancialTransactionWithRelations = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  account_id: faker.string.uuid(),
  category: { icon: 'cart', icon_color: '#2E7D32', id: faker.string.uuid(), name: 'Groceries' },
  category_id: faker.string.uuid(),
  created_at: faker.date.past(),
  date: new Date('2026-10-03T00:00:00.000Z'),
  description: 'Weekly groceries',
  id: faker.string.uuid(),
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  type: 'EXPENSE',
  updated_at: faker.date.recent(),
  value: 23490,
};

// endregion Mocks

export const mocks = { raw: rawTransactionMock };
