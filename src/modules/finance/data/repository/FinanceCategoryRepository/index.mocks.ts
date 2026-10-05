import { Test } from '@nestjs/testing';

import { FinancialCategory } from '@db/client';
import { FinanceCategoryMapper } from '@finance/data/datasource/mapper/FinanceCategoryMapper';
import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';

import { FinanceCategoryRepository } from './index';

// region Mocks

jest.mock('@finance/data/datasource/mapper/FinanceCategoryMapper');

const categoryEntityMock = new CategoryEntityFixture().build();
const categoryPersistenceMock = { id: categoryEntityMock.id } as FinancialCategory;

const categoryDatasourceMock = {
  create: jest.fn().mockResolvedValue(categoryPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  findById: jest.fn().mockResolvedValue(categoryPersistenceMock),
  findByOwners: jest.fn().mockResolvedValue([categoryPersistenceMock]),
  update: jest.fn().mockResolvedValue(categoryPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FinanceCategoryMapper.toDomain);

// endregion Spies

let setup: FinanceCategoryRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(categoryEntityMock);

  const module = await Test.createTestingModule({
    providers: [
      FinanceCategoryRepository,
      { provide: 'IFinanceCategoryDatasource', useValue: categoryDatasourceMock },
    ],
  }).compile();

  setup = module.get<FinanceCategoryRepository>(FinanceCategoryRepository);
});

const mocks = {
  categoryDatasource: categoryDatasourceMock,
  categoryEntity: categoryEntityMock,
  categoryPersistence: categoryPersistenceMock,
};
const spies = { mapper: { toDomain: mapperToDomainSpy } };

export { mocks, setup, spies };
