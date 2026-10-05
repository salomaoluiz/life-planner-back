import { faker } from '@faker-js/faker';

import { StockItem } from '@db/client';

const rawFull: StockItem = {
  barcode: '7890000000001',
  brand: 'Test Brand',
  created_at: faker.date.past(),
  description: 'Whole milk',
  expiration_date: faker.date.soon(),
  id: faker.string.uuid(),
  notes: 'Some notes',
  opening_date: faker.date.recent(),
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  purchase_date: faker.date.recent(),
  quantity: 6,
  unit: 'liter',
  updated_at: faker.date.recent(),
};
const rawMinimal: StockItem = {
  ...rawFull,
  barcode: null,
  brand: null,
  expiration_date: null,
  notes: null,
  opening_date: null,
  purchase_date: null,
};

export const mocks = { rawFull, rawMinimal };
