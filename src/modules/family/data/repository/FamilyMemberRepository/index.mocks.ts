import { Test } from '@nestjs/testing';

import { FamilyMember } from '@db/client';
import { FamilyMemberMapper } from '@family/data/datasource/mapper/FamilyMemberMapper';
import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';

import { FamilyMemberRepository } from './index';

// region Mocks

jest.mock('@family/data/datasource/mapper/FamilyMemberMapper');

const memberEntityMock = new FamilyMemberEntityFixture().build();
const memberPersistenceMock = { id: memberEntityMock.id } as FamilyMember;

const familyMemberDatasourceMock = {
  create: jest.fn().mockResolvedValue(memberPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findByEmail: jest.fn().mockResolvedValue(memberPersistenceMock),
  findByFamilyId: jest.fn().mockResolvedValue([memberPersistenceMock]),
  findById: jest.fn().mockResolvedValue(memberPersistenceMock),
  findByTokenHash: jest.fn().mockResolvedValue(memberPersistenceMock),
  findMembership: jest.fn().mockResolvedValue(memberPersistenceMock),
  join: jest.fn().mockResolvedValue(memberPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FamilyMemberMapper.toDomain);

// endregion Spies

let setup: FamilyMemberRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(memberEntityMock);

  const module = await Test.createTestingModule({
    providers: [
      FamilyMemberRepository,
      { provide: 'IFamilyMemberDatasource', useValue: familyMemberDatasourceMock },
    ],
  }).compile();

  setup = module.get<FamilyMemberRepository>(FamilyMemberRepository);
});

const mocks = {
  datasource: familyMemberDatasourceMock,
  member: memberEntityMock,
  persistence: memberPersistenceMock,
};

const spies = {
  datasource: familyMemberDatasourceMock,
  mapper: { toDomain: mapperToDomainSpy },
};

export { mocks, setup, spies };
