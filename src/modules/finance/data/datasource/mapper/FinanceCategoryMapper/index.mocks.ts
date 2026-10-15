import { faker } from '@faker-js/faker';

import { FinancialCategory } from '@db/client';

// region Mocks

const rawChildMock: FinancialCategory = {
  created_at: faker.date.past(),
  depth_level: 1,
  exclude_from_totals: false,
  icon: 'store',
  icon_color: '#2E7D32',
  id: faker.string.uuid(),
  name: 'Supermarket',
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  parent_id: faker.string.uuid(),
  system_key: null,
  type: 'INCOME',
  updated_at: faker.date.recent(),
};
const rawRootMock: FinancialCategory = { ...rawChildMock, depth_level: 0, parent_id: null };

// endregion Mocks

export const mocks = { rawChild: rawChildMock, rawRoot: rawRootMock };
