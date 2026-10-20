import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { TagController } from '@api/finance/v1/tag.controller';
import { TagService } from '@api/finance/v1/tag.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const tagApiMock = {
  createdAt: '2026-10-20T12:00:00.000Z',
  id: faker.string.uuid(),
  name: 'gasto-fixo',
  owner: 'USER',
  ownerId: userId,
  scope: 'PERSONAL',
  scopes: [{ owner: 'USER', ownerId: userId }],
  updatedAt: '2026-10-20T12:00:00.000Z',
  usageCount: 0,
};
const requestMock = { user: { id: userId } } as JwtPayload & Request;

const tagServiceMock = {
  create: jest.fn().mockResolvedValue(tagApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([tagApiMock]),
  update: jest.fn().mockResolvedValue(tagApiMock),
};

// endregion Mocks

let setup: TagController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [TagController],
    providers: [{ provide: TagService, useValue: tagServiceMock }],
  }).compile();

  setup = module.get(TagController);
});

const mocks = { request: requestMock, tag: tagApiMock, tagService: tagServiceMock };
const spies = {};

export { mocks, setup, spies };
