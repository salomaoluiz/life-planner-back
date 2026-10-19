import { Test } from '@nestjs/testing';

import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { RecurrenceFrequency } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { SplitRecurrenceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const cardMock = { ...new CreditCardEntityFixture().build(), closingDay: 10 };
// Rent of 2.000,00 from 2026-01-05 to 2026-12-05, generated up to occurrence 10 (October).
const seriesMock = new RecurrenceEntityFixture()
  .withFields({
    endDate: '2026-12-05',
    frequency: RecurrenceFrequency.MONTHLY,
    id: 'series-1',
    lastGeneratedNumber: 10,
    nextOccurrenceDate: '2026-11-05',
    occurrenceCount: 12,
    ownerId: 'user-id',
    skippedNumbers: [3, 7],
    startDate: '2026-01-05',
    value: 200000,
  })
  .build();

const ensureConsistencyMock = { execute: jest.fn() };
const invoicePaymentRepositoryMock = { findByCardIds: jest.fn() };
const recurrenceRepositoryMock = {
  applyChange: jest.fn(),
  findById: jest.fn(),
  findOccurrences: jest.fn(),
};

// endregion Mocks

let setup: SplitRecurrenceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ensureConsistencyMock.execute.mockResolvedValue({});
  invoicePaymentRepositoryMock.findByCardIds.mockResolvedValue([]);
  recurrenceRepositoryMock.applyChange.mockResolvedValue('series-2');
  recurrenceRepositoryMock.findById.mockImplementation(async (id: string) => ({
    ...seriesMock,
    id,
  }));
  recurrenceRepositoryMock.findOccurrences.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      SplitRecurrenceUseCase,
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceInvoicePaymentRepository', useValue: invoicePaymentRepositoryMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(SplitRecurrenceUseCase);
});

const mocks = {
  accessibleOwners,
  card: cardMock,
  ensureConsistency: ensureConsistencyMock,
  invoicePaymentRepository: invoicePaymentRepositoryMock,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
