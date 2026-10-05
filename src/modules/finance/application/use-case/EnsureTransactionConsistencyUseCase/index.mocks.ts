import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { EnsureTransactionConsistencyUseCase } from './index';

// region Mocks

const userId = 'user-id';
const familyId = 'family-id';
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];

const accountMock = new AccountEntityFixture().withOwnerId(userId).build();
const categoryMock = new CategoryEntityFixture()
  .withOwnerId(userId)
  .withType(TransactionType.EXPENSE)
  .build();
const inputMock = {
  accessibleOwners,
  accountId: accountMock.id,
  categoryId: categoryMock.id,
  owner: OwnerType.USER,
  ownerId: userId,
  type: TransactionType.EXPENSE,
};

const accountRepositoryMock = { findAccountById: jest.fn() };
const categoryRepositoryMock = { findCategoryById: jest.fn() };

// endregion Mocks

let setup: EnsureTransactionConsistencyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(accountMock);
  categoryRepositoryMock.findCategoryById.mockResolvedValue(categoryMock);

  const module = await Test.createTestingModule({
    providers: [
      EnsureTransactionConsistencyUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(EnsureTransactionConsistencyUseCase);
});

const mocks = {
  account: accountMock,
  accountRepository: accountRepositoryMock,
  category: categoryMock,
  categoryRepository: categoryRepositoryMock,
  familyId,
  input: inputMock,
};
const spies = {};

export { mocks, setup, spies };
