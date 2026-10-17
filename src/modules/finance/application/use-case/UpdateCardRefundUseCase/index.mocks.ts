import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { ResolveRefundLinkUseCase } from '@finance/application/use-case/ResolveRefundLinkUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SystemCategoryKey } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateCardRefundUseCase } from './index';

// region Mocks

const cardMock = { ...new CreditCardEntityFixture().build(), closingDay: 10 };
const refundMock = {
  ...new TransactionEntityFixture()
    .withCredit(SystemCategoryKey.CARD_REFUND, cardMock.id, '2026-10')
    .withValue(20000)
    .build(),
  refundedTransactionId: 'purchase-1',
};
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  creditCardId: cardMock.id,
  id: refundMock.id,
  today: '2026-10-16',
};
const cardCreditRepositoryMock = { updateRefund: jest.fn() };
const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const resolveLinkMock = { execute: jest.fn() };
const transactionRepositoryMock = { findTransactionById: jest.fn() };

// endregion Mocks

let setup: UpdateCardRefundUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  cardCreditRepositoryMock.updateRefund.mockResolvedValue({ id: refundMock.id });
  computeMock.execute.mockResolvedValue([{ card: cardMock, payments: [], totals: [] }]);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  resolveLinkMock.execute.mockResolvedValue({ cap: 50000 });
  transactionRepositoryMock.findTransactionById.mockResolvedValue(refundMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateCardRefundUseCase,
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: ResolveRefundLinkUseCase, useValue: resolveLinkMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateCardRefundUseCase);
});

const mocks = {
  card: cardMock,
  cardCreditRepository: cardCreditRepositoryMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  refund: refundMock,
  resolveLink: resolveLinkMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
