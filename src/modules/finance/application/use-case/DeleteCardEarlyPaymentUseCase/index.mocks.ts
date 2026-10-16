import { Test } from '@nestjs/testing';

import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { SystemCategoryKey } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteCardEarlyPaymentUseCase } from './index';

// region Mocks

const cardMock = new CreditCardEntityFixture().build();
const paymentMock = new TransactionEntityFixture()
  .withCredit(SystemCategoryKey.CARD_EARLY_PAYMENT, cardMock.id, '2026-10')
  .build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: cardMock.ownerId }],
  creditCardId: cardMock.id,
  id: paymentMock.id,
};
const cardCreditRepositoryMock = { deleteCredit: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const transactionRepositoryMock = { findTransactionById: jest.fn() };

// endregion Mocks

let setup: DeleteCardEarlyPaymentUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  cardCreditRepositoryMock.deleteCredit.mockResolvedValue(undefined);
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue(cardMock);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(paymentMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteCardEarlyPaymentUseCase,
      { provide: 'IFinanceCardCreditRepository', useValue: cardCreditRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteCardEarlyPaymentUseCase);
});

const mocks = {
  cardCreditRepository: cardCreditRepositoryMock,
  creditCardRepository: creditCardRepositoryMock,
  input: inputMock,
  payment: paymentMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
