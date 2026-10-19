import { Test } from '@nestjs/testing';

import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import RecurrenceEntityFixture from '@finance/domain/entity/mocks/RecurrenceEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateRecurrenceUseCase } from './index';

// region Mocks

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-id' }];
const seriesMock = new RecurrenceEntityFixture()
  .withFields({
    id: 'series-1',
    lastGeneratedNumber: 3,
    ownerId: 'user-id',
    startDate: '2026-10-05',
  })
  .build();

const accountRepositoryMock = { findAccountById: jest.fn() };
const creditCardRepositoryMock = { findCreditCardById: jest.fn() };
const ensureConsistencyMock = { execute: jest.fn() };
const recurrenceRepositoryMock = { applyChange: jest.fn(), findById: jest.fn() };

// endregion Mocks

let setup: UpdateRecurrenceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue({ status: 'ACTIVE' });
  creditCardRepositoryMock.findCreditCardById.mockResolvedValue({ status: 'ACTIVE' });
  ensureConsistencyMock.execute.mockResolvedValue({});
  recurrenceRepositoryMock.applyChange.mockResolvedValue('series-1');
  recurrenceRepositoryMock.findById.mockResolvedValue(seriesMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateRecurrenceUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateRecurrenceUseCase);
});

const mocks = {
  accessibleOwners,
  accountRepository: accountRepositoryMock,
  creditCardRepository: creditCardRepositoryMock,
  ensureConsistency: ensureConsistencyMock,
  recurrenceRepository: recurrenceRepositoryMock,
  series: seriesMock,
};
const spies = {};

export { mocks, setup, spies };
