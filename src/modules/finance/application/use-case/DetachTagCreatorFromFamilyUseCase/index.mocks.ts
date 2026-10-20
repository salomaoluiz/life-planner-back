import { Test } from '@nestjs/testing';

import { DetachTagCreatorFromFamilyUseCase } from './index';

const tagRepositoryMock = { detachFamilyScope: jest.fn().mockResolvedValue(2) };

let setup: DetachTagCreatorFromFamilyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      DetachTagCreatorFromFamilyUseCase,
      { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock },
    ],
  }).compile();

  setup = module.get(DetachTagCreatorFromFamilyUseCase);
});

const mocks = { tagRepository: tagRepositoryMock };
const spies = {};

export { mocks, setup, spies };
