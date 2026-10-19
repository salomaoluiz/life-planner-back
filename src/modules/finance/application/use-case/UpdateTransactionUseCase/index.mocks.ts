import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateTransactionUseCase } from './index';

// region Mocks

const familyId = 'family-id';
const transactionMock = new TransactionEntityFixture().build();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: transactionMock.ownerId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];
const updatedMock = { ...transactionMock, description: 'Updated' };

const cardMock = new CreditCardEntityFixture().withLimit(10_000).build();
const computeMock = { execute: jest.fn() };
const ensureConsistencyMock = { execute: jest.fn().mockResolvedValue({}) };
const installmentPlanRepositoryMock = { updateFromNumber: jest.fn() };
const installmentMock = new TransactionEntityFixture()
  .withCard(cardMock.id, '2026-10')
  .withInstallment('plan-1', 3, 10)
  .withOwnerId(transactionMock.ownerId)
  .build();
const recurringMock = {
  ...new TransactionEntityFixture()
    .withRecurrence('series-1', 4, 10)
    .withOwnerId(transactionMock.ownerId)
    .build(),
  paid: false,
};
const transactionRepositoryMock = {
  findTransactionById: jest.fn().mockResolvedValue(transactionMock),
  updateTransaction: jest.fn().mockResolvedValue(updatedMock),
};

// endregion Mocks

let setup: UpdateTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ensureConsistencyMock.execute.mockResolvedValue({});
  computeMock.execute.mockResolvedValue([{ invoices: { used: 5000 } }]);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(transactionMock);
  installmentPlanRepositoryMock.updateFromNumber.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      UpdateTransactionUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: installmentPlanRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateTransactionUseCase);
});

const mocks = {
  accessibleOwners,
  card: cardMock,
  compute: computeMock,
  ensureConsistency: ensureConsistencyMock,
  familyId,
  installment: installmentMock,
  installmentPlanRepository: installmentPlanRepositoryMock,
  recurring: recurringMock,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
  updated: updatedMock,
};
const spies = {};

export { mocks, setup, spies };
