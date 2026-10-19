import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { RecurrenceService } from '@api/finance/v1/recurrence.service';
import { CreateRecurrenceUseCase } from '@finance/application/use-case/CreateRecurrenceUseCase';
import { DeleteOccurrenceUseCase } from '@finance/application/use-case/DeleteOccurrenceUseCase';
import { DeleteRecurrenceUseCase } from '@finance/application/use-case/DeleteRecurrenceUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { GetRecurrencesUseCase } from '@finance/application/use-case/GetRecurrencesUseCase';
import { GetRecurrenceUseCase } from '@finance/application/use-case/GetRecurrenceUseCase';
import { MaterializeOccurrenceUseCase } from '@finance/application/use-case/MaterializeOccurrenceUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { ResolveCardRowsPaidUseCase } from '@finance/application/use-case/ResolveCardRowsPaidUseCase';
import { SplitRecurrenceUseCase } from '@finance/application/use-case/SplitRecurrenceUseCase';
import { UpdateRecurrenceUseCase } from '@finance/application/use-case/UpdateRecurrenceUseCase';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const seriesMock = new RecurrenceEntityFixture().withFields({ endDate: '2027-09-05' }).build();
const rowMock = new TransactionEntityFixture().withRecurrence(seriesMock.id, 1, 12).build();
const projectedMock = {
  account: seriesMock.account,
  category: seriesMock.category,
  creditCard: null,
  date: '2026-11-05',
  description: seriesMock.description,
  frequency: seriesMock.frequency,
  invoiceListDate: null,
  invoiceMonth: null,
  occurrenceCount: 12,
  occurrenceNumber: 2,
  owner: seriesMock.owner,
  ownerId: seriesMock.ownerId,
  recurrenceId: seriesMock.id,
  type: seriesMock.type,
  value: seriesMock.value,
};

const createMock = { execute: jest.fn() };
const deleteOccurrenceMock = { execute: jest.fn() };
const deleteRecurrenceMock = { execute: jest.fn() };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getProjectionsMock = { execute: jest.fn() };
const getRecurrencesMock = { execute: jest.fn() };
const getRecurrenceMock = { execute: jest.fn() };
const materializeOccurrenceMock = { execute: jest.fn() };
const materializeRecurrencesMock = { execute: jest.fn() };
const resolveCardRowsPaidMock = { execute: jest.fn() };
const splitMock = { execute: jest.fn() };
const updateMock = { execute: jest.fn() };

// endregion Mocks

let setup: RecurrenceService;

beforeEach(async () => {
  jest.clearAllMocks();
  createMock.execute.mockResolvedValue({
    occurrences: [rowMock],
    overLimit: false,
    recurrence: seriesMock,
  });
  deleteOccurrenceMock.execute.mockResolvedValue(undefined);
  deleteRecurrenceMock.execute.mockResolvedValue({ deleted: 3, detached: 1 });
  financeAccessServiceMock.resolve.mockResolvedValue(accessibleOwners);
  getProjectionsMock.execute.mockResolvedValue([projectedMock]);
  getRecurrencesMock.execute.mockResolvedValue([seriesMock]);
  getRecurrenceMock.execute.mockResolvedValue({
    occurrences: [rowMock],
    projected: [projectedMock],
    recurrence: seriesMock,
  });
  materializeOccurrenceMock.execute.mockResolvedValue({ overLimit: true, transaction: rowMock });
  materializeRecurrencesMock.execute.mockResolvedValue(undefined);
  resolveCardRowsPaidMock.execute.mockImplementation(
    async ({ transactions }: { transactions: unknown[] }) => transactions,
  );
  splitMock.execute.mockResolvedValue({
    ended: seriesMock,
    occurrences: [rowMock],
    recurrence: seriesMock,
  });
  updateMock.execute.mockResolvedValue(seriesMock);

  const module = await Test.createTestingModule({
    providers: [
      RecurrenceService,
      { provide: CreateRecurrenceUseCase, useValue: createMock },
      { provide: DeleteOccurrenceUseCase, useValue: deleteOccurrenceMock },
      { provide: DeleteRecurrenceUseCase, useValue: deleteRecurrenceMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetProjectionsUseCase, useValue: getProjectionsMock },
      { provide: GetRecurrencesUseCase, useValue: getRecurrencesMock },
      { provide: GetRecurrenceUseCase, useValue: getRecurrenceMock },
      { provide: MaterializeOccurrenceUseCase, useValue: materializeOccurrenceMock },
      { provide: MaterializeRecurrencesUseCase, useValue: materializeRecurrencesMock },
      { provide: ResolveCardRowsPaidUseCase, useValue: resolveCardRowsPaidMock },
      { provide: SplitRecurrenceUseCase, useValue: splitMock },
      { provide: UpdateRecurrenceUseCase, useValue: updateMock },
    ],
  }).compile();

  setup = module.get(RecurrenceService);
});

const mocks = {
  accessibleOwners,
  create: createMock,
  deleteOccurrence: deleteOccurrenceMock,
  deleteRecurrence: deleteRecurrenceMock,
  getProjections: getProjectionsMock,
  getRecurrence: getRecurrenceMock,
  getRecurrences: getRecurrencesMock,
  materializeOccurrence: materializeOccurrenceMock,
  materializeRecurrences: materializeRecurrencesMock,
  projected: projectedMock,
  row: rowMock,
  series: seriesMock,
  split: splitMock,
  update: updateMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
