import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetInvoiceUseCase } from './index';

// region Mocks

const cardMock = new CreditCardEntityFixture().build();
const purchaseMock = new TransactionEntityFixture().withCard(cardMock.id, '2026-10').build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  creditCardId: cardMock.id,
  invoiceMonth: '2026-10',
  today: '2026-11-02',
};
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const transactionRepositoryMock = { findCardPurchases: jest.fn() };

// endregion Mocks

let setup: GetInvoiceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([
    { card: cardMock, payments: [], totals: [{ amount: 45000, invoiceMonth: '2026-10' }] },
  ]);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  transactionRepositoryMock.findCardPurchases.mockResolvedValue([purchaseMock]);

  const module = await Test.createTestingModule({
    providers: [
      GetInvoiceUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetInvoiceUseCase);
});

const mocks = {
  card: cardMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  purchase: purchaseMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
