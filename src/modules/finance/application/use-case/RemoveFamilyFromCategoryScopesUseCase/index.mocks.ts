import { Test } from '@nestjs/testing';

import { RemoveFamilyFromCategoryScopesUseCase } from './index';

// region Mocks

const inputMock = { familyId: 'family-id' };
const categoryRepositoryMock = {
  addScope: jest.fn().mockResolvedValue(undefined),
  detachFamilyScope: jest.fn().mockResolvedValue(2),
  removeScope: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

let setup: RemoveFamilyFromCategoryScopesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      RemoveFamilyFromCategoryScopesUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(RemoveFamilyFromCategoryScopesUseCase);
});

const mocks = { categoryRepository: categoryRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
