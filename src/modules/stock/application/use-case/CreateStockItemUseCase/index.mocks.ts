import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';

import { CreateStockItemUseCase } from './index';

// region Mocks

const createdMock = new StockEntityFixture().build();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const stockRepositoryMock = {
  create: jest.fn(),
};

// endregion Mocks

let setup: CreateStockItemUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.create.mockResolvedValue(createdMock);

  const module = await Test.createTestingModule({
    providers: [
      CreateStockItemUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateStockItemUseCase);
});

const mocks = { accessibleOwners, created: createdMock, stockRepository: stockRepositoryMock };
const spies = {};

export { mocks, setup, spies };
