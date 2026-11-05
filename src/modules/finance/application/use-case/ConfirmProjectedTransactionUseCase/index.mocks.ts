import { Test } from '@nestjs/testing';

import { ComputeCardInvoicesUseCase } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import { EnsureTransactionConsistencyUseCase } from '@finance/application/use-case/EnsureTransactionConsistencyUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { ConfirmProjectedTransactionUseCase } from './index';

// region Mocks

const cardMock = { ...new CreditCardEntityFixture().withLimit(10_000).build(), closingDay: 10 };
const projectedMock = {
  ...new TransactionEntityFixture().withCard(cardMock.id, '2026-10').build(),
  date: '2026-10-20',
  projected: true,
};
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: projectedMock.ownerId }];
const confirmedMock = { ...projectedMock, projected: false, value: 9990 };

const computeMock = { execute: jest.fn() };
const ensureConsistencyMock = { execute: jest.fn() };
const transactionRepositoryMock = {
  findTransactionScalarsById: jest.fn(),
  updateTransaction: jest.fn(),
};

// endregion Mocks

let setup: ConfirmProjectedTransactionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  computeMock.execute.mockResolvedValue([{ invoices: { projectedUsed: 0, used: 5000 } }]);
  ensureConsistencyMock.execute.mockResolvedValue({ card: cardMock });
  transactionRepositoryMock.findTransactionScalarsById.mockResolvedValue(projectedMock);
  transactionRepositoryMock.updateTransaction.mockResolvedValue(confirmedMock);

  const module = await Test.createTestingModule({
    providers: [
      ConfirmProjectedTransactionUseCase,
      { provide: ComputeCardInvoicesUseCase, useValue: computeMock },
      { provide: EnsureTransactionConsistencyUseCase, useValue: ensureConsistencyMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(ConfirmProjectedTransactionUseCase);
});

const mocks = {
  accessibleOwners,
  card: cardMock,
  compute: computeMock,
  confirmed: confirmedMock,
  ensureConsistency: ensureConsistencyMock,
  input: {
    accessibleOwners,
    date: '2026-10-24',
    id: projectedMock.id,
    today: '2026-10-25',
    value: 9990,
  },
  projected: projectedMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
