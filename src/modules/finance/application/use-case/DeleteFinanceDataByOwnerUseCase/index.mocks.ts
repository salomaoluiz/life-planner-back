import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteFinanceDataByOwnerUseCase } from './index';

// region Mocks

const inputMock = { owner: OwnerType.USER, ownerId: 'user-id' };
const ownerDataRepositoryMock = { deleteAllByOwner: jest.fn() };

// endregion Mocks

let setup: DeleteFinanceDataByOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ownerDataRepositoryMock.deleteAllByOwner.mockResolvedValue(5);

  const module = await Test.createTestingModule({
    providers: [
      DeleteFinanceDataByOwnerUseCase,
      { provide: 'IFinanceOwnerDataRepository', useValue: ownerDataRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteFinanceDataByOwnerUseCase);
});

const mocks = { input: inputMock, ownerDataRepository: ownerDataRepositoryMock };
const spies = {};

export { mocks, setup, spies };
