import { Test } from '@nestjs/testing';

import { ExpandCategoryIdsUseCase } from '@finance/application/use-case/ExpandCategoryIdsUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetProjectionsUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const cardMock = new CreditCardEntityFixture().build();
const seriesMock = new RecurrenceEntityFixture()
  .withFields({
    id: 'series-1',
    lastGeneratedNumber: 1,
    notes: 'Contrato anual',
    startDate: '2026-10-05',
  })
  .build();

const expandMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const recurrenceRepositoryMock = { findByOwners: jest.fn(), findFutureNumbers: jest.fn() };

// endregion Mocks

let setup: GetProjectionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue({ ...cardMock, closingDay: 10 });
  recurrenceRepositoryMock.findByOwners.mockResolvedValue([seriesMock]);
  recurrenceRepositoryMock.findFutureNumbers.mockResolvedValue([]);
  expandMock.execute.mockImplementation(async ({ categoryIds }) => categoryIds);

  const module = await Test.createTestingModule({
    providers: [
      GetProjectionsUseCase,
      { provide: ExpandCategoryIdsUseCase, useValue: expandMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetProjectionsUseCase);
});

const mocks = {
  accessibleOwners,
  card: cardMock,
  creditCardRepository: creditCardRepositoryMock,
  expand: expandMock,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
