import { Test } from '@nestjs/testing';

import { AddFamilyToCategoryScopesUseCase } from './index';

// region Mocks

const inputMock = { familyId: 'family-id', userId: 'user-id' };
const categoryRepositoryMock = {
  addScope: jest.fn().mockResolvedValue(undefined),
  detachFamilyScope: jest.fn().mockResolvedValue(2),
  removeScope: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

let setup: AddFamilyToCategoryScopesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      AddFamilyToCategoryScopesUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(AddFamilyToCategoryScopesUseCase);
});

const mocks = { categoryRepository: categoryRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
