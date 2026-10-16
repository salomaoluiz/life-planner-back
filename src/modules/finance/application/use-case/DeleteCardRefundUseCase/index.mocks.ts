import { Test } from '@nestjs/testing';

import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SystemCategoryKey } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteCardRefundUseCase } from './index';

// region Mocks

const cardMock = new CreditCardEntityFixture().build();
const refundMock = new TransactionEntityFixture()
  .withCredit(SystemCategoryKey.CARD_REFUND, cardMock.id, '2026-10')
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  creditCardId: cardMock.id,
  id: refundMock.id,
};
const cardCreditRepositoryMock = { deleteCredit: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const transactionRepositoryMock = { findTransactionById: jest.fn() };

// endregion Mocks

let setup: DeleteCardRefundUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  cardCreditRepositoryMock.deleteCredit.mockResolvedValue(undefined);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(refundMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteCardRefundUseCase,
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteCardRefundUseCase);
});

const mocks = {
  cardCreditRepository: cardCreditRepositoryMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  refund: refundMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
