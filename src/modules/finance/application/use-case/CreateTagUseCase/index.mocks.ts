import { Test } from '@nestjs/testing';

import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateTagUseCase } from './index';

// region Mocks

const tagMock = new TagEntityFixture().build();
const personal = { owner: OwnerType.USER, ownerId: tagMock.ownerId };
const family = { owner: OwnerType.FAMILY, ownerId: 'family-1' };
const archivedFamily = { archived: true, owner: OwnerType.FAMILY, ownerId: 'family-2' };
const accessibleOwners = [personal, family, archivedFamily];

const tagRepositoryMock = {
  createTag: jest.fn().mockResolvedValue(tagMock),
  findConflictingScopes: jest.fn().mockResolvedValue([]),
};

// endregion Mocks

let setup: CreateTagUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  tagRepositoryMock.createTag.mockResolvedValue(tagMock);
  tagRepositoryMock.findConflictingScopes.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      CreateTagUseCase,
      { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateTagUseCase);
});

const mocks = {
  accessibleOwners,
  archivedFamily,
  family,
  personal,
  tag: tagMock,
  tagRepository: tagRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
