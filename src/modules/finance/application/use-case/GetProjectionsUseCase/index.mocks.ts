import { Test } from '@nestjs/testing';

import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetProjectionsUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const cardMock = new CreditCardEntityFixture().build();
const seriesMock = new RecurrenceEntityFixture()
  .withFields({ id: 'series-1', lastGeneratedNumber: 1, startDate: '2026-10-05' })
  .build();

const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const recurrenceRepositoryMock = { findByOwners: jest.fn(), findFutureNumbers: jest.fn() };

// endregion Mocks

let setup: GetProjectionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue({ ...cardMock, closingDay: 10 });
  recurrenceRepositoryMock.findByOwners.mockResolvedValue([seriesMock]);
  recurrenceRepositoryMock.findFutureNumbers.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetProjectionsUseCase,
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
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
