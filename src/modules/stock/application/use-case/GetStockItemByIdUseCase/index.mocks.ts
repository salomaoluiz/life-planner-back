import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';

import { GetStockItemByIdUseCase } from './index';

// region Mocks

const itemMock = new StockEntityFixture()
  .withOwner(OwnerType.FAMILY)
  .withOwnerId('family-id')
  .build();
const accessibleOwners = [{ owner: OwnerType.FAMILY, ownerId: 'family-id' }];
const stockRepositoryMock = { findById: jest.fn() };

// endregion Mocks

let setup: GetStockItemByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.findById.mockResolvedValue(itemMock);

  const module = await Test.createTestingModule({
    providers: [
      GetStockItemByIdUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetStockItemByIdUseCase);
});

const mocks = { accessibleOwners, item: itemMock, stockRepository: stockRepositoryMock };
const spies = {};

export { mocks, setup, spies };
