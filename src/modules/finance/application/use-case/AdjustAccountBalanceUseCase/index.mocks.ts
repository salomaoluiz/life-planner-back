import { Test } from '@nestjs/testing';

import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { AdjustAccountBalanceUseCase } from './index';

// region Mocks

const today = '2026-10-15';
const accountMock = new AccountEntityFixture().withLedgerBalance(7000).build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: accountMock.ownerId }];
// Current balance 70,00 (a later-dated row is not counted), projected 80,00.
const currentMock = { account: accountMock, balance: 7000, projectedBalance: 8000 };
const updatedMock = {
  account: { ...accountMock, ledgerBalance: 12000 },
  balance: 12000,
  projectedBalance: 13000,
};

const accountRepositoryMock = { findAccountById: jest.fn() };
const attachMock = { execute: jest.fn() };
const transactionRepositoryMock = { createTransaction: jest.fn() };

// endregion Mocks

let setup: AdjustAccountBalanceUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockReset().mockResolvedValue(accountMock);
  attachMock.execute
    .mockReset()
    .mockResolvedValueOnce([currentMock])
    .mockResolvedValueOnce([updatedMock]);
  transactionRepositoryMock.createTransaction.mockReset().mockResolvedValue({});

  const module = await Test.createTestingModule({
    providers: [
      AdjustAccountBalanceUseCase,
      { provide: AttachAccountBalancesUseCase, useValue: attachMock },
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(AdjustAccountBalanceUseCase);
});

const mocks = {
  accessibleOwners,
  account: accountMock,
  accountRepository: accountRepositoryMock,
  attach: attachMock,
  current: currentMock,
  today,
  transactionRepository: transactionRepositoryMock,
  updated: updatedMock,
};
const spies = {};

export { mocks, setup, spies };
