import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CategoryController } from '@api/finance/v1/category.controller';
import { CategoryService } from '@api/finance/v1/category.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const categoryApiMock = {
  createdAt: '2026-10-04T12:00:00.000Z',
  depthLevel: 0,
  icon: 'cart',
  iconColor: '#2E7D32',
  id: faker.string.uuid(),
  name: 'Groceries',
  owner: 'USER',
  ownerId: userId,
  parentId: null,
  type: 'EXPENSE',
  updatedAt: '2026-10-04T12:00:00.000Z',
};
const requestMock = { user: { id: userId } } as JwtPayload & Request;

const categoryServiceMock = {
  create: jest.fn().mockResolvedValue(categoryApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([categoryApiMock]),
  update: jest.fn().mockResolvedValue(categoryApiMock),
};

// endregion Mocks

let setup: CategoryController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [CategoryController],
    providers: [{ provide: CategoryService, useValue: categoryServiceMock }],
  }).compile();

  setup = module.get(CategoryController);
});

const mocks = {
  category: categoryApiMock,
  categoryService: categoryServiceMock,
  request: requestMock,
};
const spies = {};

export { mocks, setup, spies };
