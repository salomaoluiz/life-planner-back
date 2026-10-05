import { Test } from '@nestjs/testing';

import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateCategoryUseCase } from './index';

// region Mocks

const userId = 'user-id';
const familyId = 'family-id';
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];

const fixture = new CategoryEntityFixture();
const parentMock = fixture
  .withId('parent-id')
  .withOwnerId(userId)
  .withDepthLevel(0)
  .withType(TransactionType.EXPENSE)
  .build();
const createdMock = fixture.withId('created-id').withOwnerId(userId).build();

const inputMock = {
  accessibleOwners,
  icon: 'store',
  name: 'Supermarket',
  owner: OwnerType.USER,
  ownerId: userId,
  type: TransactionType.EXPENSE,
};

const categoryRepositoryMock = {
  createCategory: jest.fn().mockResolvedValue(createdMock),
  findCategoryById: jest.fn().mockResolvedValue(parentMock),
};

// endregion Mocks

let setup: CreateCategoryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  categoryRepositoryMock.findCategoryById.mockResolvedValue(parentMock);

  const module = await Test.createTestingModule({
    providers: [
      CreateCategoryUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateCategoryUseCase);
});

const mocks = {
  categoryRepository: categoryRepositoryMock,
  created: createdMock,
  familyId,
  input: inputMock,
  parent: parentMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
