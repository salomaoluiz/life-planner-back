import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CardCreditService } from '@api/finance/v1/card-credit.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateCardEarlyPaymentUseCase } from '@finance/application/use-case/CreateCardEarlyPaymentUseCase';
import { CreateCardRefundUseCase } from '@finance/application/use-case/CreateCardRefundUseCase';
import { DeleteCardEarlyPaymentUseCase } from '@finance/application/use-case/DeleteCardEarlyPaymentUseCase';
import { DeleteCardRefundUseCase } from '@finance/application/use-case/DeleteCardRefundUseCase';
import { UpdateCardEarlyPaymentUseCase } from '@finance/application/use-case/UpdateCardEarlyPaymentUseCase';
import { UpdateCardRefundUseCase } from '@finance/application/use-case/UpdateCardRefundUseCase';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { InvoicePaymentMethod, SystemCategoryKey } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const cardId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const refundMock = new TransactionEntityFixture()
  .withCredit(SystemCategoryKey.CARD_REFUND, cardId, '2026-10')
  .build();
const earlyMock = {
  ...new TransactionEntityFixture()
    .withCredit(SystemCategoryKey.CARD_EARLY_PAYMENT, cardId, '2026-10')
    .build(),
  paidFromAccountId: faker.string.uuid(),
  paidFromTransactionId: faker.string.uuid(),
  paymentMethod: InvoicePaymentMethod.ACCOUNT,
};
const useCaseMocks = {
  createEarly: { execute: jest.fn() },
  createRefund: { execute: jest.fn() },
  deleteEarly: { execute: jest.fn() },
  deleteRefund: { execute: jest.fn() },
  updateEarly: { execute: jest.fn() },
  updateRefund: { execute: jest.fn() },
};
const financeAccessServiceMock = { resolve: jest.fn() };

// endregion Mocks

let setup: CardCreditService;

beforeEach(async () => {
  jest.clearAllMocks();
  financeAccessServiceMock.resolve.mockResolvedValue(accessibleOwners);
  useCaseMocks.createEarly.execute.mockResolvedValue(earlyMock);
  useCaseMocks.createRefund.execute.mockResolvedValue(refundMock);
  useCaseMocks.deleteEarly.execute.mockResolvedValue(undefined);
  useCaseMocks.deleteRefund.execute.mockResolvedValue(undefined);
  useCaseMocks.updateEarly.execute.mockResolvedValue(earlyMock);
  useCaseMocks.updateRefund.execute.mockResolvedValue(refundMock);

  const module = await Test.createTestingModule({
    providers: [
      CardCreditService,
      { provide: CreateCardEarlyPaymentUseCase, useValue: useCaseMocks.createEarly },
      { provide: CreateCardRefundUseCase, useValue: useCaseMocks.createRefund },
      { provide: DeleteCardEarlyPaymentUseCase, useValue: useCaseMocks.deleteEarly },
      { provide: DeleteCardRefundUseCase, useValue: useCaseMocks.deleteRefund },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: UpdateCardEarlyPaymentUseCase, useValue: useCaseMocks.updateEarly },
      { provide: UpdateCardRefundUseCase, useValue: useCaseMocks.updateRefund },
    ],
  }).compile();

  setup = module.get(CardCreditService);
});

const mocks = {
  accessibleOwners,
  cardId,
  early: earlyMock,
  refund: refundMock,
  useCases: useCaseMocks,
  userId,
};
const spies = {};

export { mocks, setup, spies };
