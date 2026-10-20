import { Test } from '@nestjs/testing';

import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateTagUseCase } from './index';

// region Mocks

const tagMock = new TagEntityFixture().withName('gasto').build();
const personal = { owner: OwnerType.USER, ownerId: tagMock.ownerId };
const family = { owner: OwnerType.FAMILY, ownerId: 'family-1' };
const accessibleOwners = [personal, family];

const tagRepositoryMock = {
  findConflictingScopes: jest.fn().mockResolvedValue([]),
  findTagById: jest.fn().mockResolvedValue(tagMock),
  updateTag: jest.fn().mockResolvedValue(tagMock),
};

// endregion Mocks

let setup: UpdateTagUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  tagRepositoryMock.findConflictingScopes.mockResolvedValue([]);
  tagRepositoryMock.findTagById.mockResolvedValue(tagMock);
  tagRepositoryMock.updateTag.mockResolvedValue(tagMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateTagUseCase,
      { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateTagUseCase);
});

const mocks = {
  accessibleOwners,
  family,
  personal,
  tag: tagMock,
  tagRepository: tagRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
