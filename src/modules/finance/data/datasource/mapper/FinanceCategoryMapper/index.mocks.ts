import { faker } from '@faker-js/faker';

import { FinancialCategoryWithScopes } from '@finance/data/datasource/mapper/FinanceCategoryMapper';

// region Mocks

const rawChildMock: FinancialCategoryWithScopes = {
  all_scopes: false,
  created_at: faker.date.past(),
  creator_id: null,
  depth_level: 1,
  exclude_from_totals: false,
  icon: 'store',
  icon_color: '#2E7D32',
  id: faker.string.uuid(),
  name: 'Supermarket',
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  parent_id: faker.string.uuid(),
  scopes: [],
  system_key: null,
  type: 'INCOME',
  updated_at: faker.date.recent(),
};
const rawRootMock: FinancialCategoryWithScopes = {
  ...rawChildMock,
  depth_level: 0,
  parent_id: null,
};

const creatorId = faker.string.uuid();
const familyId = faker.string.uuid();
const rawAllMock: FinancialCategoryWithScopes = {
  ...rawRootMock,
  all_scopes: true,
  creator_id: creatorId,
  owner: 'USER',
  owner_id: creatorId,
  scopes: [
    { category_id: rawRootMock.id, id: faker.string.uuid(), owner: 'USER', owner_id: creatorId },
    { category_id: rawRootMock.id, id: faker.string.uuid(), owner: 'FAMILY', owner_id: familyId },
  ],
};

// endregion Mocks

export const mocks = { rawAll: rawAllMock, rawChild: rawChildMock, rawRoot: rawRootMock };
