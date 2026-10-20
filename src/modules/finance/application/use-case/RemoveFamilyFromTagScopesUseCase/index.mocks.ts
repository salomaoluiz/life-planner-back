import { Test } from '@nestjs/testing';

import { RemoveFamilyFromTagScopesUseCase } from './index';

const tagRepositoryMock = { removeScope: jest.fn().mockResolvedValue(undefined) };

let setup: RemoveFamilyFromTagScopesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      RemoveFamilyFromTagScopesUseCase,
      { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock },
    ],
  }).compile();

  setup = module.get(RemoveFamilyFromTagScopesUseCase);
});

const mocks = { tagRepository: tagRepositoryMock };
const spies = {};

export { mocks, setup, spies };
