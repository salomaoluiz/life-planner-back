import { Test } from '@nestjs/testing';

import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetRecurrencesUseCase } from './index';

// region Mocks

const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'user-id' },
  { owner: OwnerType.FAMILY, ownerId: 'family-id' },
];
const recurrencesMock = [new RecurrenceEntityFixture().build()];
const recurrenceRepositoryMock = { findByOwners: jest.fn() };

// endregion Mocks

let setup: GetRecurrencesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  recurrenceRepositoryMock.findByOwners.mockResolvedValue(recurrencesMock);

  const module = await Test.createTestingModule({
    providers: [
      GetRecurrencesUseCase,
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetRecurrencesUseCase);
});

const mocks = {
  accessibleOwners,
  recurrenceRepository: recurrenceRepositoryMock,
  recurrences: recurrencesMock,
};
const spies = {};

export { mocks, setup, spies };
