import { Test } from '@nestjs/testing';

import { FinancialAccount } from '@db/client';
import { FinanceAccountMapper } from '@finance/data/datasource/mapper/FinanceAccountMapper';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';

import { FinanceAccountRepository } from './index';

// region Mocks

jest.mock('@finance/data/datasource/mapper/FinanceAccountMapper');

const accountEntityMock = new AccountEntityFixture().build();
const accountPersistenceMock = { id: accountEntityMock.id } as FinancialAccount;

const accountDatasourceMock = {
  create: jest.fn().mockResolvedValue(accountPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  findById: jest.fn().mockResolvedValue(accountPersistenceMock),
  findByOwners: jest.fn().mockResolvedValue([accountPersistenceMock]),
  update: jest.fn().mockResolvedValue(accountPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FinanceAccountMapper.toDomain);

// endregion Spies

let setup: FinanceAccountRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(accountEntityMock);

  const module = await Test.createTestingModule({
    providers: [
      FinanceAccountRepository,
      { provide: 'IFinanceAccountDatasource', useValue: accountDatasourceMock },
    ],
  }).compile();

  setup = module.get<FinanceAccountRepository>(FinanceAccountRepository);
});

const mocks = {
  accountDatasource: accountDatasourceMock,
  accountEntity: accountEntityMock,
  accountPersistence: accountPersistenceMock,
};
const spies = { mapper: { toDomain: mapperToDomainSpy } };

export { mocks, setup, spies };
