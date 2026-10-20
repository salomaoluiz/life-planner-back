import { faker } from '@faker-js/faker';

import { FinancialTagWithScopes } from './index';

// region Mocks

const ownerIdMock = faker.string.uuid();
const rawSingle: FinancialTagWithScopes = {
  all_scopes: false,
  created_at: new Date('2026-10-20T12:00:00.000Z'),
  creator_id: ownerIdMock,
  id: faker.string.uuid(),
  name: 'gasto-fixo',
  owner: 'FAMILY',
  owner_id: ownerIdMock,
  scopes: [],
  updated_at: new Date('2026-10-20T13:00:00.000Z'),
};
const rawAll: FinancialTagWithScopes = {
  ...rawSingle,
  all_scopes: true,
  owner: 'USER',
  scopes: [
    { id: 's1', owner: 'USER', owner_id: ownerIdMock, tag_id: rawSingle.id },
    { id: 's2', owner: 'FAMILY', owner_id: 'family-1', tag_id: rawSingle.id },
  ],
};

// endregion Mocks

const mocks = { rawAll, rawSingle };
const spies = {};

export { mocks, spies };
