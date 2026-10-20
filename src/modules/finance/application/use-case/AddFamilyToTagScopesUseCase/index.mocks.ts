import { Test } from '@nestjs/testing';

import { AddFamilyToTagScopesUseCase } from './index';

const tagRepositoryMock = { addScope: jest.fn().mockResolvedValue(undefined) };

let setup: AddFamilyToTagScopesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      AddFamilyToTagScopesUseCase,
      { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock },
    ],
  }).compile();

  setup = module.get(AddFamilyToTagScopesUseCase);
});

const mocks = { tagRepository: tagRepositoryMock };
const spies = {};

export { mocks, setup, spies };
