import { Test } from '@nestjs/testing';

import { StockMapper } from '@stock/data/datasource/mapper/StockMapper';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';

import { StockRepository } from './index';

jest.mock('@stock/data/datasource/mapper/StockMapper');

const stockEntityMock = new StockEntityFixture().build();
const rawItem = { id: stockEntityMock.id };
const datasource = {
  applyMovement: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  deleteByOwner: jest.fn(),
  exists: jest.fn(),
  findById: jest.fn(),
  findByOwners: jest.fn(),
  findMovements: jest.fn(),
  update: jest.fn(),
};
const spies = {
  toDomain: jest.mocked(StockMapper.toDomain),
  toMovement: jest.mocked(StockMapper.toMovement),
};
let setup: StockRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  spies.toDomain.mockReturnValue(stockEntityMock);
  spies.toMovement.mockReturnValue({ id: 'movement' } as never);
  datasource.create.mockResolvedValue(rawItem);
  datasource.findById.mockResolvedValue(rawItem);
  datasource.findByOwners.mockResolvedValue([rawItem]);
  datasource.findMovements.mockResolvedValue([{ id: 'm' }]);
  datasource.update.mockResolvedValue(rawItem);

  const module = await Test.createTestingModule({
    providers: [StockRepository, { provide: 'IStockDatasource', useValue: datasource }],
  }).compile();

  setup = module.get(StockRepository);
});

const mocks = { datasource, entity: stockEntityMock, raw: rawItem };

export { mocks, setup, spies };
