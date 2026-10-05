import { Test } from '@nestjs/testing';

import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateCategoryUseCase } from './index';

// region Mocks

const userId = 'user-id';
const familyId = 'family-id';
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];

// USER tree:  a(0) --> b(1) --> c(2)        d(0) --> e(1)        i(0, INCOME)
// FAMILY:     f(0)          stranger-owned: x(0)
const fixture = new CategoryEntityFixture().withOwnerId(userId);
function node(id: string, depthLevel: number, parentId?: string, type = TransactionType.EXPENSE) {
  fixture.withOwnerId(userId).withOwner(OwnerType.USER);

  return fixture
    .withId(id)
    .withDepthLevel(depthLevel)
    .withParentId(parentId)
    .withType(type)
    .build();
}
const a = node('a', 0);
const b = node('b', 1, 'a');
const c = node('c', 2, 'b');
const d = node('d', 0);
const e = node('e', 1, 'd');
const i = node('i', 0, undefined, TransactionType.INCOME);
const f = {
  ...node('f', 0),
  owner: OwnerType.FAMILY,
  ownerId: familyId,
};
const x = { ...node('x', 0), ownerId: 'stranger' };
const tree: CategoryEntity[] = [a, b, c, d, e, i];
const everything: CategoryEntity[] = [...tree, f, x];

const updatedMock = { ...a, name: 'Renamed' };

const categoryRepositoryMock = {
  findCategories: jest.fn(),
  findCategoryById: jest.fn(),
  updateCategory: jest.fn(),
};

// endregion Mocks

const transactionRepositoryMock = { countByCategoryIds: jest.fn() };

let setup: UpdateCategoryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategoryById.mockImplementation(async (id: string) =>
    everything.find((category) => category.id === id),
  );
  categoryRepositoryMock.findCategories.mockResolvedValue(tree);
  categoryRepositoryMock.updateCategory.mockResolvedValue(updatedMock);
  transactionRepositoryMock.countByCategoryIds.mockResolvedValue(0);

  const module = await Test.createTestingModule({
    providers: [
      UpdateCategoryUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateCategoryUseCase);
});

const mocks = {
  accessibleOwners,
  categoryRepository: categoryRepositoryMock,
  nodes: { a, b, c, d, e, f, i, x },
  transactionRepository: transactionRepositoryMock,
  updated: updatedMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
