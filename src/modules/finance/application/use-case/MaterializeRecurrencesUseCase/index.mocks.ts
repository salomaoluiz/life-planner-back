import { Test } from '@nestjs/testing';

import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { RecurrenceUnit } from '@finance/domain/enum';
import { EXTERNAL_PROJECTION_SOURCE } from '@finance/domain/repository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { MaterializeRecurrencesUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const cardMock = new CreditCardEntityFixture().build();
const weeklySeries = new RecurrenceEntityFixture()
  .withFields({
    frequency: { interval: 1, unit: RecurrenceUnit.WEEK },
    id: 'series-1',
    lastGeneratedNumber: 1,
    nextOccurrenceDate: '2026-10-08',
    startDate: '2026-10-01',
  })
  .build();

const creditCardRepositoryMock = { findCreditCardsByIds: jest.fn() };
const invoicePaymentRepositoryMock = { findByCardIds: jest.fn() };
const gateMock = { runOnce: jest.fn() };
const recurrenceRepositoryMock = { findDue: jest.fn(), materialize: jest.fn() };
const transferRepositoryMock = { materializeTransferSeries: jest.fn() };

// endregion Mocks

let setup: MaterializeRecurrencesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  creditCardRepositoryMock.findCreditCardsByIds.mockResolvedValue([
    { ...cardMock, closingDay: 10 },
  ]);
  invoicePaymentRepositoryMock.findByCardIds.mockResolvedValue([]);
  gateMock.runOnce.mockImplementation(
    async (_owners: string[], _today: string, task: () => Promise<void>) => task(),
  );
  recurrenceRepositoryMock.findDue.mockResolvedValue([weeklySeries]);
  recurrenceRepositoryMock.materialize.mockResolvedValue(undefined);
  transferRepositoryMock.materializeTransferSeries.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      MaterializeRecurrencesUseCase,
      { provide: MaterializationGate, useValue: gateMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInvoicePaymentRepository', useValue: invoicePaymentRepositoryMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
      { provide: 'IFinanceTransferRepository', useValue: transferRepositoryMock },
      { provide: EXTERNAL_PROJECTION_SOURCE, useValue: externalSourceMock },
    ],
  }).compile();

  setup = module.get(MaterializeRecurrencesUseCase);
});

const externalSourceMock = { findProjections: jest.fn(), materialize: jest.fn() };
const mocks = {
  accessibleOwners,
  card: cardMock,
  creditCardRepository: creditCardRepositoryMock,
  externalSource: externalSourceMock,
  gate: gateMock,
  invoicePaymentRepository: invoicePaymentRepositoryMock,
  recurrenceRepository: recurrenceRepositoryMock,
  transferRepository: transferRepositoryMock,
  weeklySeries,
};
const spies = {};

export { mocks, setup, spies };
