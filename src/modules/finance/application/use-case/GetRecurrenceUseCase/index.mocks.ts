import { Test } from '@nestjs/testing';

import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetRecurrenceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const seriesMock = new RecurrenceEntityFixture()
  .withFields({ id: 'series-1', ownerId: 'user-id', skippedNumbers: [3] })
  .build();
const occurrencesMock = [
  { ...new TransactionEntityFixture().build(), occurrenceNumber: 1 },
  { ...new TransactionEntityFixture().build(), occurrenceNumber: 5 },
];

const getProjectionsMock = { project: jest.fn() };
const recurrenceRepositoryMock = { findById: jest.fn(), findOccurrences: jest.fn() };

// endregion Mocks

let setup: GetRecurrenceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  getProjectionsMock.project.mockResolvedValue([{ occurrenceNumber: 2 }]);
  recurrenceRepositoryMock.findById.mockResolvedValue(seriesMock);
  recurrenceRepositoryMock.findOccurrences.mockResolvedValue(occurrencesMock);

  const module = await Test.createTestingModule({
    providers: [
      GetRecurrenceUseCase,
      { provide: GetProjectionsUseCase, useValue: getProjectionsMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetRecurrenceUseCase);
});

const mocks = {
  accessibleOwners,
  getProjections: getProjectionsMock,
  occurrences: occurrencesMock,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
