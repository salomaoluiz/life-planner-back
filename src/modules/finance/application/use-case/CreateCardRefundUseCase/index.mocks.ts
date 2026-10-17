import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ResolveRefundLinkUseCase } from '@finance/application/use-case/ResolveRefundLinkUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateCardRefundUseCase } from './index';

// region Mocks

// Closing day 10 and today 2026-10-16: October is closed, November is the open invoice.
const cardMock = { ...new CreditCardEntityFixture().build(), closingDay: 10 };
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  creditCardId: cardMock.id,
  date: '2026-10-16',
  description: 'Refund · Notebook',
  invoiceMonth: '2026-10',
  refundedTransactionId: 'purchase-1',
  today: '2026-10-16',
  value: 20000,
};
const cardCreditRepositoryMock = { createRefund: jest.fn() };
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const resolveLinkMock = { execute: jest.fn() };

// endregion Mocks

let setup: CreateCardRefundUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  cardCreditRepositoryMock.createRefund.mockResolvedValue({ id: 'refund-1' });
  computeMock.execute.mockResolvedValue([{ card: cardMock, payments: [], totals: [] }]);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  resolveLinkMock.execute.mockResolvedValue({ cap: 50000 });

  const module = await Test.createTestingModule({
    providers: [
      CreateCardRefundUseCase,
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: ResolveRefundLinkUseCase, useValue: resolveLinkMock },
    ],
  }).compile();

  setup = module.get(CreateCardRefundUseCase);
});

const mocks = {
  card: cardMock,
  cardCreditRepository: cardCreditRepositoryMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  resolveLink: resolveLinkMock,
};
const spies = {};

export { mocks, setup, spies };
