import { faker } from '@faker-js/faker';

import { Family } from '@db/client';

// region Mocks

const rawFamilyMock: Family = {
  created_at: faker.date.past(),
  id: faker.string.uuid(),
  name: `Family ${faker.person.lastName()}`,
  owner_id: faker.string.uuid(),
  updated_at: faker.date.recent(),
};

// endregion

export const mocks = {
  raw: rawFamilyMock,
};
