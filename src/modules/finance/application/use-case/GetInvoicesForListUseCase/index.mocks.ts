import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import { FindInvoicesInRangeUseCase } from '@finance/application/use-case/FindInvoicesInRangeUseCase';
import { ResolveSearchCategoryIdsUseCase } from '@finance/application/use-case/ResolveSearchCategoryIdsUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { InvoicePaymentMethod } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetInvoicesForListUseCase } from './index';

// region Mocks

// closing 31, due 10, payment 5: the 2026-10 invoice is planned for 2026-11-05.
const cardMock = new CreditCardEntityFixture().withTitle('Main').build();
const purchaseMock = new TransactionEntityFixture().withCard(cardMock.id, '2026-10').build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  month: '2026-11',
  today: '2026-10-15',
};
const totalsMock = [
  { amount: 45000, invoiceMonth: '2026-10' },
  { amount: 0, invoiceMonth: '2026-09' },
];
const computeMock = { execute: jest.fn() };
const expandMock = { execute: jest.fn() };
const resolveSearchMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCards: jest.fn() };
const transactionRepositoryMock = { findCardPurchases: jest.fn() };

// endregion Mocks

let setup: GetInvoicesForListUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([
    { card: cardMock, invoices: {}, payments: [], totals: totalsMock },
  ]);
  creditCardRepositoryMock.findCreditCards.mockResolvedValue([cardMock]);
  transactionRepositoryMock.findCardPurchases.mockResolvedValue([purchaseMock]);
  expandMock.execute.mockImplementation(async ({ categoryIds }) => categoryIds);
  resolveSearchMock.execute.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetInvoicesForListUseCase,
      FindInvoicesInRangeUseCase,
      { provide: ExpandCategoryIdsUseCase, useValue: expandMock },
      { provide: ResolveSearchCategoryIdsUseCase, useValue: resolveSearchMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetInvoicesForListUseCase);
});

const payment = {
  accountId: null,
  accountName: null,
  amount: 45000,
  method: InvoicePaymentMethod.EXTERNAL,
  paidOn: '2026-10-30',
  referenceMonth: '2026-10',
};
const mocks = {
  card: cardMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  expand: expandMock,
  input: inputMock,
  payment,
  purchase: purchaseMock,
  resolveSearch: resolveSearchMock,
  totals: totalsMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
