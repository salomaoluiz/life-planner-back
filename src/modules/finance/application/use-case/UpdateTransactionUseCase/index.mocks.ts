import { Test } from '@nestjs/testing';

import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
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

const ensureConsistencyMock = { execute: jest.fn().mockResolvedValue(undefined) };
const transactionRepositoryMock = {
  findTransactionById: jest.fn().mockResolvedValue(transactionMock),
  updateTransaction: jest.fn().mockResolvedValue(updatedMock),
};

// endregion Mocks

let setup: UpdateTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ensureConsistencyMock.execute.mockResolvedValue(undefined);
  transactionRepositoryMock.findTransactionById.mockResolvedValue(transactionMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateTransactionUseCase,
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateTransactionUseCase);
});

const mocks = {
  accessibleOwners,
  ensureConsistency: ensureConsistencyMock,
  familyId,
  transaction: transactionMock,
  transactionRepository: transactionRepositoryMock,
  updated: updatedMock,
};
const spies = {};

export { mocks, setup, spies };
