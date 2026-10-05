import { Test } from '@nestjs/testing';

import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteCategoryUseCase } from './index';

// region Mocks

const categoryMock = new CategoryEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: categoryMock.ownerId }];

const categoryRepositoryMock = {
  deleteCategory: jest.fn().mockResolvedValue(undefined),
  findCategoryById: jest.fn().mockResolvedValue(categoryMock),
};

// endregion Mocks

let setup: DeleteCategoryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategoryById.mockResolvedValue(categoryMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteCategoryUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteCategoryUseCase);
});

const mocks = {
  accessibleOwners,
  category: categoryMock,
  categoryRepository: categoryRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
