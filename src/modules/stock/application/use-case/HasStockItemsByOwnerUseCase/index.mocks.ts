import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { HasStockItemsByOwnerUseCase } from './index';

// region Mocks

const inputMock = { owner: OwnerType.FAMILY, ownerId: 'family-id' };
const stockRepositoryMock = { existsByOwner: jest.fn().mockResolvedValue(false) };

// endregion Mocks

let setup: HasStockItemsByOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.existsByOwner.mockResolvedValue(false);

  const module = await Test.createTestingModule({
    providers: [
      HasStockItemsByOwnerUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(HasStockItemsByOwnerUseCase);
});

const mocks = { input: inputMock, stockRepository: stockRepositoryMock };
const spies = {};

export { mocks, setup, spies };
