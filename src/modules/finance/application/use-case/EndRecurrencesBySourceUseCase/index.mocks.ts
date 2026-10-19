import { Test } from '@nestjs/testing';

import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { EndRecurrencesBySourceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const seriesMock = new RecurrenceEntityFixture()
  .withFields({ id: 'series-1', lastGeneratedNumber: 3, startDate: '2026-10-05' })
  .build();
const recurrenceRepositoryMock = { applyChange: jest.fn(), findByOwners: jest.fn() };

// endregion Mocks

let setup: EndRecurrencesBySourceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  recurrenceRepositoryMock.applyChange.mockResolvedValue('series-1');
  recurrenceRepositoryMock.findByOwners.mockResolvedValue([seriesMock]);

  const module = await Test.createTestingModule({
    providers: [
      EndRecurrencesBySourceUseCase,
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(EndRecurrencesBySourceUseCase);
});

const mocks = {
  accessibleOwners,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
