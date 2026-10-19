import { Test } from '@nestjs/testing';

import { DeleteRecurrenceUseCase } from '@finance/application/use-case/DeleteRecurrenceUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteOccurrenceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
// Monthly from 2026-01-05, generated up to occurrence 10; occurrence 8 was deleted (a hole).
const seriesMock = new RecurrenceEntityFixture()
  .withFields({
    id: 'series-1',
    lastGeneratedNumber: 10,
    ownerId: 'user-id',
    skippedNumbers: [14],
    startDate: '2026-01-05',
  })
  .build();

const deleteRecurrenceMock = { execute: jest.fn() };
const deleteTransactionMock = { execute: jest.fn() };
const recurrenceRepositoryMock = {
  findById: jest.fn(),
  findOccurrences: jest.fn(),
  removeFrom: jest.fn(),
  skipNumber: jest.fn(),
};

// endregion Mocks

let setup: DeleteOccurrenceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  deleteRecurrenceMock.execute.mockResolvedValue({ deleted: 0, detached: 0 });
  deleteTransactionMock.execute.mockResolvedValue(undefined);
  recurrenceRepositoryMock.findById.mockResolvedValue(seriesMock);
  recurrenceRepositoryMock.findOccurrences.mockResolvedValue(
    [1, 2, 3, 4, 5, 6, 7, 9, 10].map((number) => ({
      id: `row-${number}`,
      occurrenceNumber: number,
    })),
  );
  recurrenceRepositoryMock.removeFrom.mockResolvedValue({ deleted: 0, detached: 0 });
  recurrenceRepositoryMock.skipNumber.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      DeleteOccurrenceUseCase,
      { provide: DeleteRecurrenceUseCase, useValue: deleteRecurrenceMock },
      { provide: DeleteTransactionUseCase, useValue: deleteTransactionMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteOccurrenceUseCase);
});

const mocks = {
  accessibleOwners,
  deleteRecurrence: deleteRecurrenceMock,
  deleteTransaction: deleteTransactionMock,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
