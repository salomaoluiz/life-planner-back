import { Test } from '@nestjs/testing';

import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UndoInvoicePaymentUseCase } from './index';

// region Mocks

const cardMock = new CreditCardEntityFixture().build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  creditCardId: cardMock.id,
  invoiceMonth: '2026-10',
};
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const invoicePaymentRepositoryMock = { findByCardAndMonth: jest.fn(), undoPayment: jest.fn() };

// endregion Mocks

let setup: UndoInvoicePaymentUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  invoicePaymentRepositoryMock.findByCardAndMonth.mockResolvedValue({ id: 'payment-1' });
  invoicePaymentRepositoryMock.undoPayment.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      UndoInvoicePaymentUseCase,
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInvoicePaymentRepository', useValue: invoicePaymentRepositoryMock },
    ],
  }).compile();

  setup = module.get(UndoInvoicePaymentUseCase);
});

const mocks = {
  card: cardMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  invoicePaymentRepository: invoicePaymentRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
