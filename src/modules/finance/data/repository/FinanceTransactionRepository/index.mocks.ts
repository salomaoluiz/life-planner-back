import { Test } from '@nestjs/testing';

import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';

import { FinanceTransactionRepository } from './index';

// region Mocks

jest.mock('@finance/data/datasource/mapper/FinanceTransactionMapper');

const transactionEntityMock = new TransactionEntityFixture().build();
const transactionPersistenceMock = {
  id: transactionEntityMock.id,
} as FinancialTransactionWithRelations;

const transactionDatasourceMock = {
  countByAccountId: jest.fn().mockResolvedValue(2),
  countByCategoryIds: jest.fn().mockResolvedValue(0),
  create: jest.fn().mockResolvedValue(transactionPersistenceMock),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  findById: jest.fn().mockResolvedValue(transactionPersistenceMock),
  findByOwners: jest.fn().mockResolvedValue([transactionPersistenceMock]),
  update: jest.fn().mockResolvedValue(transactionPersistenceMock),
};

// endregion Mocks

// region Spies

const mapperToDomainSpy = jest.mocked(FinanceTransactionMapper.toDomain);

// endregion Spies

let setup: FinanceTransactionRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  mapperToDomainSpy.mockReturnValue(transactionEntityMock);

  const module = await Test.createTestingModule({
    providers: [
      FinanceTransactionRepository,
      { provide: 'IFinanceTransactionDatasource', useValue: transactionDatasourceMock },
    ],
  }).compile();

  setup = module.get<FinanceTransactionRepository>(FinanceTransactionRepository);
});

const mocks = {
  transactionDatasource: transactionDatasourceMock,
  transactionEntity: transactionEntityMock,
  transactionPersistence: transactionPersistenceMock,
};
const spies = { mapper: { toDomain: mapperToDomainSpy } };

export { mocks, setup, spies };
