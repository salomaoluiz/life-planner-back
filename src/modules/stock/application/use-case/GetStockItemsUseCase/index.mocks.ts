import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';

import { GetStockItemsUseCase } from './index';

// region Mocks

const userId = 'user-id';
const familyId = 'family-id';
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];
const stockRepositoryMock = { findByOwners: jest.fn().mockResolvedValue([]) };

// endregion Mocks

let setup: GetStockItemsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.findByOwners.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetStockItemsUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetStockItemsUseCase);
});

function item(description: string, id: string, expiration?: string) {
  const fixture = new StockEntityFixture().withDescription(description).withId(id);

  return (expiration ? fixture.withExpirationDate(new Date(expiration)) : fixture).build();
}

const mocks = { accessibleOwners, familyId, item, stockRepository: stockRepositoryMock, userId };
const spies = {};

export { mocks, setup, spies };
