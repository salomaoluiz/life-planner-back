import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { MaterializeOccurrenceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const cardMock = { ...new CreditCardEntityFixture().withLimit(10_000).build(), closingDay: 10 };
const seriesMock = new RecurrenceEntityFixture()
  .withFields({
    id: 'series-1',
    lastGeneratedNumber: 1,
    ownerId: 'user-id',
    skippedNumbers: [4],
    startDate: '2026-10-05',
  })
  .build();
const transactionMock = new TransactionEntityFixture().build();

const computeMock = { execute: jest.fn() };
const ensureConsistencyMock = { execute: jest.fn() };
const recurrenceRepositoryMock = { createOccurrence: jest.fn(), findById: jest.fn() };

// endregion Mocks

let setup: MaterializeOccurrenceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([{ invoices: { used: 5000 } }]);
  ensureConsistencyMock.execute.mockResolvedValue({});
  recurrenceRepositoryMock.createOccurrence.mockResolvedValue(transactionMock);
  recurrenceRepositoryMock.findById.mockResolvedValue(seriesMock);

  const module = await Test.createTestingModule({
    providers: [
      MaterializeOccurrenceUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(MaterializeOccurrenceUseCase);
});

const mocks = {
  accessibleOwners,
  card: cardMock,
  compute: computeMock,
  ensureConsistency: ensureConsistencyMock,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
  transaction: transactionMock,
};
const spies = {};

export { mocks, setup, spies };
