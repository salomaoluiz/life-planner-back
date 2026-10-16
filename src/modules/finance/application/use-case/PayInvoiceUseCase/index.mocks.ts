import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { InvoicePaymentMethod } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { PayInvoiceUseCase } from './index';

// region Mocks

const userId = 'user-id';
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const cardMock = new CreditCardEntityFixture().withOwnerId(userId).build();
const accountMock = new AccountEntityFixture().withOwnerId(userId).build();
const inputMock = {
  accessibleOwners,
  accountId: accountMock.id,
  creditCardId: cardMock.id,
  invoiceMonth: '2026-10',
  method: InvoicePaymentMethod.ACCOUNT,
  paidOn: '2026-11-05',
  today: '2026-11-02',
};
// Card closes on 31: on 2026-11-02 the 2026-10 invoice is CLOSED with 45000.
const dataMock = [
  {
    card: cardMock,
    invoices: {},
    payments: [],
    totals: [{ amount: 45000, invoiceMonth: '2026-10' }],
  },
];
const accountRepositoryMock = { findAccountById: jest.fn() };
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const invoicePaymentRepositoryMock = { payInvoice: jest.fn() };

// endregion Mocks

let setup: PayInvoiceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(accountMock);
  computeMock.execute.mockResolvedValue(dataMock);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  invoicePaymentRepositoryMock.payInvoice.mockResolvedValue({ id: 'payment-1' });

  const module = await Test.createTestingModule({
    providers: [
      PayInvoiceUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInvoicePaymentRepository', useValue: invoicePaymentRepositoryMock },
    ],
  }).compile();

  setup = module.get(PayInvoiceUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  card: cardMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  data: dataMock,
  input: inputMock,
  invoicePaymentRepository: invoicePaymentRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
