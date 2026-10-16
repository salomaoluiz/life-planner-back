import { Test } from '@nestjs/testing';

import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { InvoicePaymentMethod } from '@finance/domain/enum';

import { ComputeCardInvoicesUseCase } from './index';

// region Mocks

const cardMock = new CreditCardEntityFixture().build();
const paymentRepositoryMock = { findByCardIds: jest.fn() };
const transactionRepositoryMock = { sumCardInvoices: jest.fn() };
const paymentMock = {
  accountId: 'acc-1',
  accountName: 'Bank',
  amount: 2000,
  creditCardId: cardMock.id,
  invoiceMonth: '2026-09',
  method: InvoicePaymentMethod.ACCOUNT,
  paidOn: '2026-10-05',
};

// endregion Mocks

let setup: ComputeCardInvoicesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  paymentRepositoryMock.findByCardIds.mockResolvedValue([paymentMock]);
  transactionRepositoryMock.sumCardInvoices.mockResolvedValue([
    { amount: 2000, creditCardId: cardMock.id, invoiceMonth: '2026-09' },
    { amount: 45000, creditCardId: cardMock.id, invoiceMonth: '2026-10' },
    { amount: 999, creditCardId: 'other-card', invoiceMonth: '2026-10' },
  ]);

  const module = await Test.createTestingModule({
    providers: [
      ComputeCardInvoicesUseCase,
      { provide: 'IFinanceInvoicePaymentRepository', useValue: paymentRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(ComputeCardInvoicesUseCase);
});

const mocks = {
  card: cardMock,
  paymentRepository: paymentRepositoryMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
