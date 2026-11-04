import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { LoadFilterCategoriesUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const categoriesMock = [{ id: 'market' }, { id: 'greens', parentId: 'market' }];
const categoryRepositoryMock = { findCategories: jest.fn() };

// endregion Mocks

let setup: LoadFilterCategoriesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategories.mockResolvedValue(categoriesMock);

  const module = await Test.createTestingModule({
    providers: [
      LoadFilterCategoriesUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(LoadFilterCategoriesUseCase);
});

const mocks = {
  accessibleOwners,
  categories: categoriesMock,
  categoryRepository: categoryRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
