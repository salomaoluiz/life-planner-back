import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ResolveSearchCategoryIdsUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const categoryRepositoryMock = { findCategories: jest.fn() };

function category(id: string, name: string, parentId?: string) {
  return { id, name, parentId };
}

// endregion Mocks

let setup: ResolveSearchCategoryIdsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategories.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      ResolveSearchCategoryIdsUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(ResolveSearchCategoryIdsUseCase);
});

const mocks = { accessibleOwners, category, categoryRepository: categoryRepositoryMock };
const spies = {};

export { mocks, setup, spies };
