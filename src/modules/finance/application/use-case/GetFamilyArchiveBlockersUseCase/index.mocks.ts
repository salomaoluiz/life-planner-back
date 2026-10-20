import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';

import { GetFamilyArchiveBlockersUseCase } from './index';

// region Mocks

const familyId = 'family-id';
const today = '2026-10-20';

const cardMock = { id: 'card-1', title: 'House card' };

function invoice(overrides: Record<string, unknown> = {}) {
  return { amountDue: 15000, payment: null, referenceMonth: '2026-10', ...overrides };
}
function row(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-10-10',
    description: 'Power',
    id: 'tx-1',
    paid: false,
    value: 23000,
    ...overrides,
  };
}

const computeMock = { execute: jest.fn() };
const creditCardRepositoryMock = { findCreditCards: jest.fn() };
const planRepositoryMock = { findPlansByOwners: jest.fn() };
const recurrenceRepositoryMock = { findByOwners: jest.fn() };
const transactionRepositoryMock = { findTransactions: jest.fn() };

// endregion Mocks

let setup: GetFamilyArchiveBlockersUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([]);
  creditCardRepositoryMock.findCreditCards.mockResolvedValue([cardMock]);
  planRepositoryMock.findPlansByOwners.mockResolvedValue([]);
  recurrenceRepositoryMock.findByOwners.mockResolvedValue([]);
  transactionRepositoryMock.findTransactions.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetFamilyArchiveBlockersUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: 'IFinanceCreditCardRepository', useValue: creditCardRepositoryMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetFamilyArchiveBlockersUseCase);
});

const mocks = {
  card: cardMock,
  compute: computeMock,
  creditCardRepository: creditCardRepositoryMock,
  familyId,
  invoice,
  planRepository: planRepositoryMock,
  recurrenceRepository: recurrenceRepositoryMock,
  row,
  today,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
