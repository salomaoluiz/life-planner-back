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
  countByCreditCardId: jest.fn().mockResolvedValue(0),
  countCardPurchases: jest
    .fn()
    .mockResolvedValue([{ count: 4, credit_card_id: 'card-1', invoice_month: '2026-10' }]),
  countForExport: jest.fn().mockResolvedValue(9),
  create: jest.fn().mockResolvedValue(transactionPersistenceMock),
  createMany: jest.fn().mockResolvedValue(2),
  delete: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  findById: jest.fn().mockResolvedValue(transactionPersistenceMock),
  findByOwners: jest.fn().mockResolvedValue([transactionPersistenceMock]),
  findCardPurchases: jest.fn().mockResolvedValue([transactionPersistenceMock]),
  findDuplicateCandidates: jest.fn().mockResolvedValue([
    {
      account_id: 'a1',
      credit_card_id: null,
      date: new Date('2026-10-02T00:00:00.000Z'),
      description: 'x',
      type: 'EXPENSE',
      value: 100,
    },
  ]),
  findForExport: jest.fn().mockResolvedValue([transactionPersistenceMock]),
  findInvoiceTotals: jest.fn().mockResolvedValue([
    {
      amount: 450,
      credit_card_id: 'card-1',
      invoice_month: '2026-10',
      projected_amount: 120,
      projected_count: 1,
    },
  ]),
  findScalarsById: jest.fn(),
  findUnpaidAccountRows: jest.fn().mockResolvedValue([
    {
      account_id: 'a1',
      category_id: 'c1',
      currency: 'BRL',
      date: new Date('2026-10-02T00:00:00.000Z'),
      description: 'Rent',
      id: 't1',
      occurrence_number: null,
      owner: 'USER',
      owner_id: 'u1',
      recurrence_id: null,
      type: 'EXPENSE',
      value: 1000,
    },
  ]),
  sumDashboardRows: jest.fn().mockResolvedValue([
    {
      amount: 900,
      category_id: 'cat-1',
      count: 2,
      credit_card_id: null,
      date: '2026-10-03',
      invoice_month: null,
      paid: true,
      tag_id: null,
      type: 'EXPENSE',
    },
  ]),
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
