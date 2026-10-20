import { Test } from '@nestjs/testing';

import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteTagUseCase } from './index';

// region Mocks

const tagMock = new TagEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: tagMock.ownerId }];

const tagRepositoryMock = {
  deleteTag: jest.fn().mockResolvedValue(undefined),
  findTagById: jest.fn().mockResolvedValue(tagMock),
};

// endregion Mocks

let setup: DeleteTagUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  tagRepositoryMock.findTagById.mockResolvedValue(tagMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteTagUseCase,
      { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteTagUseCase);
});

const mocks = { accessibleOwners, tag: tagMock, tagRepository: tagRepositoryMock };
const spies = {};

export { mocks, setup, spies };
