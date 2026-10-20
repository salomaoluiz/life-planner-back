import { Test } from '@nestjs/testing';

import {
  FinanceTagMapper,
  FinancialTagWithScopes,
} from '@finance/data/datasource/mapper/FinanceTagMapper';
import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';

import { FinanceTagRepository } from './index';

// region Mocks

jest.mock('@finance/data/datasource/mapper/FinanceTagMapper');

const tagEntityMock = new TagEntityFixture().build();
const tagPersistenceMock = { id: tagEntityMock.id } as FinancialTagWithScopes;

const tagDatasourceMock = {
  addScope: jest.fn().mockResolvedValue(undefined),
  countUsage: jest.fn().mockResolvedValue(new Map([[tagEntityMock.id, 5]])),
  create: jest.fn().mockResolvedValue(tagPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  detachFamilyScope: jest.fn().mockResolvedValue(2),
  exists: jest.fn().mockResolvedValue(true),
  findById: jest.fn().mockResolvedValue(tagPersistenceMock),
  findByOwners: jest.fn().mockResolvedValue([tagPersistenceMock]),
  findConflicts: jest.fn().mockResolvedValue([tagPersistenceMock]),
  removeScope: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(tagPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FinanceTagMapper.toDomain);

// endregion Spies

let setup: FinanceTagRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(tagEntityMock);

  const module = await Test.createTestingModule({
    providers: [
      FinanceTagRepository,
      { provide: 'IFinanceTagDatasource', useValue: tagDatasourceMock },
    ],
  }).compile();

  setup = module.get<FinanceTagRepository>(FinanceTagRepository);
});

const mocks = {
  tagDatasource: tagDatasourceMock,
  tagEntity: tagEntityMock,
  tagPersistence: tagPersistenceMock,
};
const spies = { mapper: { toDomain: mapperToDomainSpy } };

export { mocks, setup, spies };
