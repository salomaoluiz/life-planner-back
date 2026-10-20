import { faker } from '@faker-js/faker';

import { FinancialAccount } from '@db/client';

// region Mocks

const rawAccountMock: FinancialAccount = {
  created_at: faker.date.past(),
  currency: 'BRL' as const,
  icon: 'bank',
  id: faker.string.uuid(),
  initial_balance: 100000,
  ledger_balance: -2500,
  name: `Account ${faker.word.noun()}`,
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  status: 'ARCHIVED',
  updated_at: faker.date.recent(),
};

// endregion Mocks

export const mocks = { raw: rawAccountMock };
