import { Test } from '@nestjs/testing';

import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteCategoryUseCase } from './index';

// region Mocks

const categoryMock = new CategoryEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: categoryMock.ownerId }];

const categoryRepositoryMock = {
  deleteCategory: jest.fn().mockResolvedValue(undefined),
  findCategories: jest.fn().mockResolvedValue([categoryMock]),
  findCategoryById: jest.fn().mockResolvedValue(categoryMock),
};
const transactionRepositoryMock = { countByCategoryIds: jest.fn().mockResolvedValue(0) };

// endregion Mocks

let setup: DeleteCategoryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategoryById.mockResolvedValue(categoryMock);
  categoryRepositoryMock.findCategories.mockResolvedValue([categoryMock]);
  transactionRepositoryMock.countByCategoryIds.mockResolvedValue(0);

  const module = await Test.createTestingModule({
    providers: [
      DeleteCategoryUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteCategoryUseCase);
});

const mocks = {
  accessibleOwners,
  category: categoryMock,
  categoryRepository: categoryRepositoryMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
