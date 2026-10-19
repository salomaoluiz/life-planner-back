import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { RecurrenceFrequency, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateRecurrenceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const cardMock = new CreditCardEntityFixture().build();
const recurrenceMock = new RecurrenceEntityFixture().build();
const occurrencesMock = [new TransactionEntityFixture().build()];

const computeCardInvoicesMock = { execute: jest.fn() };
const ensureConsistencyMock = { execute: jest.fn() };
const recurrenceRepositoryMock = {
  create: jest.fn(),
  findById: jest.fn(),
  findOccurrences: jest.fn(),
};

const inputMock = {
  accessibleOwners,
  accountId: 'account-1',
  categoryId: 'category-1',
  date: '2026-10-05',
  description: 'Rent',
  frequency: RecurrenceFrequency.MONTHLY,
  owner: OwnerType.USER,
  ownerId: 'user-id',
  today: '2026-10-17',
  type: TransactionType.EXPENSE,
  value: 200000,
};

// endregion Mocks

let setup: CreateRecurrenceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeCardInvoicesMock.execute.mockResolvedValue([{ invoices: { used: cardMock.limit + 1 } }]);
  ensureConsistencyMock.execute.mockResolvedValue({});
  recurrenceRepositoryMock.create.mockResolvedValue('recurrence-1');
  recurrenceRepositoryMock.findById.mockResolvedValue(recurrenceMock);
  recurrenceRepositoryMock.findOccurrences.mockResolvedValue(occurrencesMock);

  const module = await Test.createTestingModule({
    providers: [
      CreateRecurrenceUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeCardInvoicesMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateRecurrenceUseCase);
});

const mocks = {
  card: cardMock,
  computeCardInvoices: computeCardInvoicesMock,
  ensureConsistency: ensureConsistencyMock,
  input: inputMock,
  occurrences: occurrencesMock,
  recurrence: recurrenceMock,
  recurrenceRepository: recurrenceRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
