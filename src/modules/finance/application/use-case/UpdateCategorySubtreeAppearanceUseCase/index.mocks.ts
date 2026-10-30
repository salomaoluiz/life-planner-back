import { Test } from '@nestjs/testing';

import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateCategorySubtreeAppearanceUseCase } from './index';

// region Mocks

const userId = 'user-id';
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const fixture = new CategoryEntityFixture();
const edited = fixture.build();
const child = fixture.withParentId(edited.id).build();
const grandchild = fixture.withParentId(child.id).build();
const stranger = fixture.build();

const updateCategoryUseCaseMock = { execute: jest.fn() };
const categoryRepositoryMock = { findCategories: jest.fn() };

// endregion Mocks

let setup: UpdateCategorySubtreeAppearanceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  updateCategoryUseCaseMock.execute.mockResolvedValue(edited);
  categoryRepositoryMock.findCategories.mockResolvedValue([edited, child, grandchild, stranger]);

  const module = await Test.createTestingModule({
    providers: [
      UpdateCategorySubtreeAppearanceUseCase,
      { provide: UpdateCategoryUseCase, useValue: updateCategoryUseCaseMock },
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateCategorySubtreeAppearanceUseCase);
});

const mocks = {
  accessibleOwners,
  categoryRepository: categoryRepositoryMock,
  child,
  edited,
  grandchild,
  updateCategoryUseCase: updateCategoryUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
