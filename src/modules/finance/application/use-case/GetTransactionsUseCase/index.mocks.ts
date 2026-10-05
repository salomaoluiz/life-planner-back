import { Test } from '@nestjs/testing';

import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetTransactionsUseCase } from './index';

// region Mocks

const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const transactionsMock = [
  new TransactionEntityFixture().build(),
  new TransactionEntityFixture().build(),
];

const transactionRepositoryMock = {
  findTransactions: jest.fn().mockResolvedValue(transactionsMock),
};

// endregion Mocks

let setup: GetTransactionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionRepositoryMock.findTransactions.mockResolvedValue(transactionsMock);

  const module = await Test.createTestingModule({
    providers: [
      GetTransactionsUseCase,
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetTransactionsUseCase);
});

const mocks = {
  accessibleOwners,
  transactionRepository: transactionRepositoryMock,
  transactions: transactionsMock,
};
const spies = {};

export { mocks, setup, spies };
