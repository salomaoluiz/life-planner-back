import { Test } from '@nestjs/testing';

import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { RecurrenceFrequency } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { MaterializeRecurrencesUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const cardMock = new CreditCardEntityFixture().build();
const weeklySeries = new RecurrenceEntityFixture()
  .withFields({
    frequency: RecurrenceFrequency.WEEKLY,
    id: 'series-1',
    lastGeneratedNumber: 1,
    nextOccurrenceDate: '2026-10-08',
    startDate: '2026-10-01',
  })
  .build();

const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const invoicePaymentRepositoryMock = { findByCardIds: jest.fn() };
const recurrenceRepositoryMock = { findDue: jest.fn(), materialize: jest.fn() };

// endregion Mocks

let setup: MaterializeRecurrencesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue({ ...cardMock, closingDay: 10 });
  invoicePaymentRepositoryMock.findByCardIds.mockResolvedValue([]);
  recurrenceRepositoryMock.findDue.mockResolvedValue([weeklySeries]);
  recurrenceRepositoryMock.materialize.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      MaterializeRecurrencesUseCase,
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInvoicePaymentRepository', useValue: invoicePaymentRepositoryMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(MaterializeRecurrencesUseCase);
});

const mocks = {
  accessibleOwners,
  card: cardMock,
  creditCardRepository: creditCardRepositoryMock,
  invoicePaymentRepository: invoicePaymentRepositoryMock,
  recurrenceRepository: recurrenceRepositoryMock,
  weeklySeries,
};
const spies = {};

export { mocks, setup, spies };
