import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { InvoicePaymentMethod } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateCardEarlyPaymentUseCase } from './index';

// region Mocks

// Closing day 10, today 2026-10-16: October (net 1.000,00) is the closed invoice to pay early.
const cardMock = { ...new CreditCardEntityFixture().build(), closingDay: 10 };
const accountMock = new AccountEntityFixture().withOwnerId(cardMock.ownerId).build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  accountId: accountMock.id,
  creditCardId: cardMock.id,
  date: '2026-10-16',
  description: 'Early payment',
  invoiceMonth: '2026-10',
  method: InvoicePaymentMethod.ACCOUNT,
  today: '2026-10-16',
  value: 60000,
};
const accountRepositoryMock = { findAccountById: jest.fn() };
const cardCreditRepositoryMock = { createEarlyPayment: jest.fn() };
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };

// endregion Mocks

let setup: CreateCardEarlyPaymentUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(accountMock);
  cardCreditRepositoryMock.createEarlyPayment.mockResolvedValue({ id: 'early-1' });
  computeMock.execute.mockResolvedValue([
    { card: cardMock, payments: [], totals: [{ amount: 100000, invoiceMonth: '2026-10' }] },
  ]);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);

  const module = await Test.createTestingModule({
    providers: [
      CreateCardEarlyPaymentUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateCardEarlyPaymentUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  card: cardMock,
  cardCreditRepository: cardCreditRepositoryMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
};
const spies = {};

export { mocks, setup, spies };
