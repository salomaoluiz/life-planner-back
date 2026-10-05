import { faker } from '@faker-js/faker';

import { FinancialAccount } from '@db/client';

// region Mocks

const rawAccountMock: FinancialAccount = {
  balance: -2500,
  created_at: faker.date.past(),
  icon: 'bank',
  id: faker.string.uuid(),
  name: `Account ${faker.word.noun()}`,
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  status: 'ARCHIVED',
  updated_at: faker.date.recent(),
};

// endregion Mocks

export const mocks = { raw: rawAccountMock };
