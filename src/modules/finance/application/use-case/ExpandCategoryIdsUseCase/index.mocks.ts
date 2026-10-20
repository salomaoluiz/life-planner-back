import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ExpandCategoryIdsUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const categoryRepositoryMock = { findCategories: jest.fn() };

function category(id: string, parentId?: string) {
  return { id, parentId };
}

// endregion Mocks

let setup: ExpandCategoryIdsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategories.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      ExpandCategoryIdsUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(ExpandCategoryIdsUseCase);
});

const mocks = { accessibleOwners, category, categoryRepository: categoryRepositoryMock };
const spies = {};

export { mocks, setup, spies };
