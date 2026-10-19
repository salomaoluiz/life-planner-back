import { Test } from '@nestjs/testing';

import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteRecurrenceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const seriesMock = new RecurrenceEntityFixture()
  .withFields({ id: 'series-1', ownerId: 'user-id' })
  .build();
const recurrenceRepositoryMock = { findById: jest.fn(), removeFrom: jest.fn() };

// endregion Mocks

let setup: DeleteRecurrenceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  recurrenceRepositoryMock.findById.mockResolvedValue(seriesMock);
  recurrenceRepositoryMock.removeFrom.mockResolvedValue({ deleted: 3, detached: 1 });

  const module = await Test.createTestingModule({
    providers: [
      DeleteRecurrenceUseCase,
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteRecurrenceUseCase);
});

const mocks = {
  accessibleOwners,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
