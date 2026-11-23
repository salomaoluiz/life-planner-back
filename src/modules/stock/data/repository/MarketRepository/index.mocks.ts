import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { MarketRepository, toMarket } from './index';

const raw = {
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  id: 'm1',
  name: 'Bom Preço',
  neighborhood: 'Centro',
  owner: 'USER' as const,
  owner_id: 'user-id',
  status: 'ACTIVE' as const,
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};
const spies = {
  create: jest.fn(),
  deleteMany: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};
const databaseMock = { client: { stockMarket: spies } };
let setup: MarketRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [MarketRepository, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(MarketRepository);
});

export { raw, setup, spies, toMarket };
