import { Test } from '@nestjs/testing';

import { Family } from '@db/client';
import { FamilyMapper } from '@family/data/datasource/mapper/FamilyMapper';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { FamilyRepository } from './index';

// region Mocks

jest.mock('@family/data/datasource/mapper/FamilyMapper');

const familyEntityMock = new FamilyEntityFixture().build();
const familyPersistenceMock = { id: familyEntityMock.id } as Family;

const familyDatasourceMock = {
  create: jest.fn().mockResolvedValue(familyPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn().mockResolvedValue(familyPersistenceMock),
  findByUserId: jest.fn().mockResolvedValue([familyPersistenceMock]),
  isMember: jest.fn().mockResolvedValue(true),
  update: jest.fn().mockResolvedValue(familyPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FamilyMapper.toDomain);

// endregion Spies

let setup: FamilyRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(familyEntityMock);

  const module = await Test.createTestingModule({
    providers: [FamilyRepository, { provide: 'IFamilyDatasource', useValue: familyDatasourceMock }],
  }).compile();

  setup = module.get<FamilyRepository>(FamilyRepository);
});

const mocks = {
  familyDatasource: familyDatasourceMock,
  familyEntity: familyEntityMock,
  familyPersistence: familyPersistenceMock,
};

const spies = {
  familyDatasource: familyDatasourceMock,
  mapper: { toDomain: mapperToDomainSpy },
};

export { mocks, setup, spies };
