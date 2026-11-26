import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { FindExpiringLotsForOwnersUseCase } from './index';

// region Mocks

const owners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];
const stockRepositoryMock = { findExpiringLots: jest.fn() };

// endregion Mocks

let setup: FindExpiringLotsForOwnersUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.findExpiringLots.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      FindExpiringLotsForOwnersUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(FindExpiringLotsForOwnersUseCase);
});

const mocks = { owners, stockRepository: stockRepositoryMock };

export { mocks, setup };
