import { Test } from '@nestjs/testing';

import { StockItem } from '@db/client';
import { StockMapper } from '@stock/data/datasource/mapper/StockMapper';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';

import { StockRepository } from './index';

// region Mocks

jest.mock('@stock/data/datasource/mapper/StockMapper');

const stockEntityMock = new StockEntityFixture().build();
const stockPersistenceMock = { id: stockEntityMock.id } as StockItem;

const stockDatasourceMock = {
  create: jest.fn().mockResolvedValue(stockPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  findById: jest.fn().mockResolvedValue(stockPersistenceMock),
  findByOwners: jest.fn().mockResolvedValue([stockPersistenceMock]),
  update: jest.fn().mockResolvedValue(stockPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(StockMapper.toDomain);

// endregion Spies

let setup: StockRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(stockEntityMock);

  const module = await Test.createTestingModule({
    providers: [StockRepository, { provide: 'IStockDatasource', useValue: stockDatasourceMock }],
  }).compile();

  setup = module.get<StockRepository>(StockRepository);
});

const mocks = {
  stockDatasource: stockDatasourceMock,
  stockEntity: stockEntityMock,
  stockPersistence: stockPersistenceMock,
};
const spies = { mapper: { toDomain: mapperToDomainSpy } };

export { mocks, setup, spies };
