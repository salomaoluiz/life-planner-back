import { Test } from '@nestjs/testing';

import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetTagsUseCase } from './index';

// region Mocks

const userId = 'user-1';
const personal = { owner: OwnerType.USER, ownerId: userId };
const family = { owner: OwnerType.FAMILY, ownerId: 'family-1' };
const accessibleOwners = [personal, family];
const tagRepositoryMock = { findTags: jest.fn().mockResolvedValue([]) };

// endregion Mocks

let setup: GetTagsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  tagRepositoryMock.findTags.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [GetTagsUseCase, { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock }],
  }).compile();

  setup = module.get(GetTagsUseCase);
});

const mocks = {
  accessibleOwners,
  family,
  fixture: TagEntityFixture,
  personal,
  tagRepository: tagRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
