import { Test } from '@nestjs/testing';

import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteFinanceDataByOwnerUseCase } from './index';

// region Mocks

const inputMock = { owner: OwnerType.USER, ownerId: 'user-id' };
const ownerDataRepositoryMock = { deleteAllByOwner: jest.fn() };

// endregion Mocks

const gateMock = { invalidate: jest.fn() };

let setup: DeleteFinanceDataByOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  ownerDataRepositoryMock.deleteAllByOwner.mockResolvedValue(5);

  const module = await Test.createTestingModule({
    providers: [
      { provide: MaterializationGate, useValue: gateMock },
      DeleteFinanceDataByOwnerUseCase,
      { provide: 'IFinanceOwnerDataRepository', useValue: ownerDataRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteFinanceDataByOwnerUseCase);
});

const mocks = { gate: gateMock, input: inputMock, ownerDataRepository: ownerDataRepositoryMock };
const spies = {};

export { mocks, setup, spies };
