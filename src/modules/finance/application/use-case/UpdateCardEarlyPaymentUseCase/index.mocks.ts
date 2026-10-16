import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { InvoicePaymentMethod, SystemCategoryKey } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateCardEarlyPaymentUseCase } from './index';

// region Mocks

// October net after a 600,00 early payment on a 1.000,00 invoice: 400,00 left to pay.
const cardMock = { ...new CreditCardEntityFixture().build(), closingDay: 10 };
const accountMock = new AccountEntityFixture().withOwnerId(cardMock.ownerId).build();
const otherAccountMock = new AccountEntityFixture().withOwnerId(cardMock.ownerId).build();
const paymentMock = {
  ...new TransactionEntityFixture()
    .withCredit(SystemCategoryKey.CARD_EARLY_PAYMENT, cardMock.id, '2026-10')
    .withValue(60000)
    .build(),
  paidFromAccountId: accountMock.id,
  paidFromTransactionId: 'debit-1',
  paymentMethod: InvoicePaymentMethod.ACCOUNT,
};
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  creditCardId: cardMock.id,
  id: paymentMock.id,
  today: '2026-10-16',
};
const accountRepositoryMock = { findAccountById: jest.fn() };
const cardCreditRepositoryMock = { updateEarlyPayment: jest.fn() };
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const transactionRepositoryMock = { findTransactionById: jest.fn() };

// endregion Mocks

let setup: UpdateCardEarlyPaymentUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(otherAccountMock);
  cardCreditRepositoryMock.updateEarlyPayment.mockResolvedValue({ id: paymentMock.id });
  computeMock.execute.mockResolvedValue([
    {
      card: cardMock,
      payments: [],
      totals: [{ amount: 40000, earlyPaid: 60000, invoiceMonth: '2026-10' }],
    },
  ]);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(paymentMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateCardEarlyPaymentUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateCardEarlyPaymentUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  card: cardMock,
  cardCreditRepository: cardCreditRepositoryMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  otherAccount: otherAccountMock,
  payment: paymentMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
