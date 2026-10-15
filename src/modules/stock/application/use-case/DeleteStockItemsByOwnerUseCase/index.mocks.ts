import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteStockItemsByOwnerUseCase } from './index';

// region Mocks

const inputMock = { owner: OwnerType.FAMILY, ownerId: 'family-id' };
const stockRepositoryMock = { deleteByOwner: jest.fn() };

// endregion Mocks

let setup: DeleteStockItemsByOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stockRepositoryMock.deleteByOwner.mockResolvedValue(2);

  const module = await Test.createTestingModule({
    providers: [
      DeleteStockItemsByOwnerUseCase,
      { provide: 'IStockRepository', useValue: stockRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteStockItemsByOwnerUseCase);
});

const mocks = { input: inputMock, stockRepository: stockRepositoryMock };
const spies = {};

export { mocks, setup, spies };
