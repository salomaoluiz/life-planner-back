import { Test } from '@nestjs/testing';

import InstallmentPlanEntityFixture from '@finance/domain/entity/mocks/InstallmentPlanEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';

import { ResolveRefundLinkUseCase } from './index';

// region Mocks

const planMock = new InstallmentPlanEntityFixture().build();
const purchaseMock = new TransactionEntityFixture()
  .withCard(planMock.creditCardId, '2026-10')
  .withValue(50000)
  .build();
const planRepositoryMock = { findPlanById: jest.fn() };
const transactionRepositoryMock = { findTransactionById: jest.fn() };

// endregion Mocks

let setup: ResolveRefundLinkUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  planRepositoryMock.findPlanById.mockResolvedValue(planMock);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(purchaseMock);

  const module = await Test.createTestingModule({
    providers: [
      ResolveRefundLinkUseCase,
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(ResolveRefundLinkUseCase);
});

const mocks = {
  plan: planMock,
  planRepository: planRepositoryMock,
  purchase: purchaseMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
