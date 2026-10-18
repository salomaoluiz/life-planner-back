import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';

import { ResolveCardRowsPaidUseCase } from './index';

// region Mocks

// closing 31: on 2026-10-15 the 2026-10 invoice is open and 2026-09 is closed.
const cardMock = new CreditCardEntityFixture().build();
const accountRowMock = new TransactionEntityFixture().withPaid(false).build();
const openRowMock = new TransactionEntityFixture().withCard(cardMock.id, '2026-10').build();
const closedRowMock = new TransactionEntityFixture().withCard(cardMock.id, '2026-09').build();
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };

// endregion Mocks

let setup: ResolveCardRowsPaidUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  computeMock.execute.mockResolvedValue([
    {
      card: cardMock,
      payments: [],
      totals: [
        { amount: 5000, invoiceMonth: '2026-10' },
        { amount: 7000, invoiceMonth: '2026-09' },
      ],
    },
  ]);

  const module = await Test.createTestingModule({
    providers: [
      ResolveCardRowsPaidUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
    ],
  }).compile();

  setup = module.get(ResolveCardRowsPaidUseCase);
});

const mocks = {
  accountRow: accountRowMock,
  card: cardMock,
  closedRow: closedRowMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  openRow: openRowMock,
  today: '2026-10-15',
};
const spies = {};

export { mocks, setup, spies };
