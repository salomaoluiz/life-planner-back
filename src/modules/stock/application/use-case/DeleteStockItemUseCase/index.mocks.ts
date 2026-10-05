import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';

import { DeleteStockItemUseCase } from './index';

// region Mocks

const itemMock = new StockEntityFixture().withOwnerId('user-id').build();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const stockRepositoryMock = {
  delete: jest.fn(),
  findById: jest.fn(),
};

// endregion Mocks

let setup: DeleteStockItemUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.delete.mockResolvedValue(undefined);
  stockRepositoryMock.findById.mockResolvedValue(itemMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteStockItemUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteStockItemUseCase);
});

const mocks = { accessibleOwners, item: itemMock, stockRepository: stockRepositoryMock };
const spies = {};

export { mocks, setup, spies };
