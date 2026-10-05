import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';

import { UpdateStockItemUseCase } from './index';

// region Mocks

const itemMock = new StockEntityFixture().withOwnerId('user-id').build();
const updatedMock = { ...itemMock, quantity: 1 };
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const stockRepositoryMock = {
  findById: jest.fn(),
  update: jest.fn(),
};

// endregion Mocks

let setup: UpdateStockItemUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.findById.mockResolvedValue(itemMock);
  stockRepositoryMock.update.mockResolvedValue(updatedMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateStockItemUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateStockItemUseCase);
});

const mocks = {
  accessibleOwners,
  item: itemMock,
  stockRepository: stockRepositoryMock,
  updated: updatedMock,
};
const spies = {};

export { mocks, setup, spies };
