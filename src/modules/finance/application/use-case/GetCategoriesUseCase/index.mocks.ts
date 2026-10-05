import { Test } from '@nestjs/testing';

import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetCategoriesUseCase } from './index';

// region Mocks

const userId = 'user-id';
const familyId = 'family-id';
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];

const fixture = new CategoryEntityFixture();
const incomeA = fixture.withName('Salary').withType(TransactionType.INCOME).build();
const expenseZ = fixture.withName('Zoo').withType(TransactionType.EXPENSE).build();
const expenseB = fixture.withName('bakery').withType(TransactionType.EXPENSE).build();
const expenseA = fixture.withName('Auto').withType(TransactionType.EXPENSE).build();
const unsorted = [incomeA, expenseZ, expenseB, expenseA];

const categoryRepositoryMock = { findCategories: jest.fn().mockResolvedValue(unsorted) };

// endregion Mocks

let setup: GetCategoriesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategories.mockResolvedValue(unsorted);

  const module = await Test.createTestingModule({
    providers: [
      GetCategoriesUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetCategoriesUseCase);
});

const mocks = { accessibleOwners, categoryRepository: categoryRepositoryMock, familyId, userId };
const spies = {};

export { mocks, setup, spies };
