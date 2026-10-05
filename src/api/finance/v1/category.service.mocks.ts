import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CategoryService } from '@api/finance/v1/category.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateCategoryUseCase } from '@finance/application/use-case/CreateCategoryUseCase';
import { DeleteCategoryUseCase } from '@finance/application/use-case/DeleteCategoryUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { UpdateCategoryUseCase } from '@finance/application/use-case/UpdateCategoryUseCase';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const rootResultMock = {
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  depthLevel: 0,
  icon: 'cart',
  iconColor: '#2E7D32',
  id: faker.string.uuid(),
  name: 'Groceries',
  owner: OwnerType.USER,
  ownerId: userId,
  parentId: undefined,
  type: TransactionType.EXPENSE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};
const childResultMock = {
  ...rootResultMock,
  depthLevel: 1,
  id: faker.string.uuid(),
  parentId: rootResultMock.id,
};
const rootApiMock = {
  createdAt: '2026-10-04T12:00:00.000Z',
  depthLevel: 0,
  icon: 'cart',
  iconColor: '#2E7D32',
  id: rootResultMock.id,
  name: 'Groceries',
  owner: 'USER',
  ownerId: userId,
  parentId: null,
  type: 'EXPENSE',
  updatedAt: '2026-10-04T13:00:00.000Z',
};

const createCategoryUseCaseMock = { execute: jest.fn().mockResolvedValue(rootResultMock) };
const deleteCategoryUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getCategoriesUseCaseMock = { execute: jest.fn().mockResolvedValue([rootResultMock]) };
const updateCategoryUseCaseMock = { execute: jest.fn().mockResolvedValue(rootResultMock) };

// endregion Mocks

let setup: CategoryService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CategoryService,
      { provide: CreateCategoryUseCase, useValue: createCategoryUseCaseMock },
      { provide: DeleteCategoryUseCase, useValue: deleteCategoryUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetCategoriesUseCase, useValue: getCategoriesUseCaseMock },
      { provide: UpdateCategoryUseCase, useValue: updateCategoryUseCaseMock },
    ],
  }).compile();

  setup = module.get(CategoryService);
});

const mocks = {
  accessibleOwners,
  childResult: childResultMock,
  createCategoryUseCase: createCategoryUseCaseMock,
  deleteCategoryUseCase: deleteCategoryUseCaseMock,
  getCategoriesUseCase: getCategoriesUseCaseMock,
  rootApi: rootApiMock,
  updateCategoryUseCase: updateCategoryUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
