import { Test } from '@nestjs/testing';

import { FinanceRecurrenceMapper } from '@finance/data/datasource/mapper/FinanceRecurrenceMapper';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import RecurrenceEntity from '@finance/domain/entity/RecurrenceEntity';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';

import { FinanceRecurrenceRepository } from './index';

// region Mocks

jest.mock('@finance/data/datasource/mapper/FinanceRecurrenceMapper');
jest.mock('@finance/data/datasource/mapper/FinanceTransactionMapper');

const recurrenceDatasourceMock = {
  apply: jest.fn().mockResolvedValue('recurrence-1'),
  create: jest.fn().mockResolvedValue('recurrence-1'),
  createOccurrence: jest.fn().mockResolvedValue({ id: 'transaction-1' }),
  findById: jest.fn().mockResolvedValue({ id: 'recurrence-1' }),
  findByOwners: jest.fn().mockResolvedValue([{ id: 'recurrence-1' }]),
  findDue: jest.fn().mockResolvedValue([{ id: 'recurrence-1' }]),
  findFutureNumbers: jest.fn().mockResolvedValue([{ occurrence_number: 7, recurrence_id: 'r-1' }]),
  findOccurrences: jest.fn().mockResolvedValue([{ id: 'transaction-1' }]),
  materialize: jest.fn().mockResolvedValue(undefined),
  removeFrom: jest.fn().mockResolvedValue({ deleted: 0, detached: 0 }),
  skipNumber: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

const recurrenceMapperSpy = jest.mocked(FinanceRecurrenceMapper.toDomain);
const transactionMapperSpy = jest.mocked(FinanceTransactionMapper.toDomain);

let setup: FinanceRecurrenceRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  recurrenceMapperSpy.mockReturnValue({ id: 'recurrence-1' } as RecurrenceEntity);
  transactionMapperSpy.mockReturnValue({ id: 'transaction-1' } as TransactionEntity);

  const module = await Test.createTestingModule({
    providers: [
      FinanceRecurrenceRepository,
      { provide: 'IFinanceRecurrenceDatasource', useValue: recurrenceDatasourceMock },
    ],
  }).compile();

  setup = module.get(FinanceRecurrenceRepository);
});

const mocks = { datasource: recurrenceDatasourceMock };
const spies = { recurrenceMapper: recurrenceMapperSpy, transactionMapper: transactionMapperSpy };

export { mocks, setup, spies };
