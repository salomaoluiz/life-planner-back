import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import TransferEntityFixture from '@finance/domain/entity/mocks/TransferEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateTransferUseCase } from './index';

// region Mocks

const fromAccount = new AccountEntityFixture().withId('acc-from').build();
const toAccount = new AccountEntityFixture().withId('acc-to').build();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: fromAccount.ownerId },
  { owner: OwnerType.USER, ownerId: toAccount.ownerId },
];
const transferMock = new TransferEntityFixture().build();
const input = {
  accessibleOwners,
  amountOut: 100000,
  dateOut: '2026-11-04',
  description: 'Savings',
  fromAccountId: 'acc-from',
  paid: true,
  requesterId: 'user-1',
  toAccountId: 'acc-to',
};

// endregion Mocks

const accountRepositoryMock = { findAccountsByIds: jest.fn() };
const transferRepositoryMock = { createTransfer: jest.fn() };

let setup: CreateTransferUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountsByIds.mockResolvedValue([fromAccount, toAccount]);
  transferRepositoryMock.createTransfer.mockResolvedValue(transferMock);

  const module = await Test.createTestingModule({
    providers: [
      CreateTransferUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceTransferRepository', useValue: transferRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateTransferUseCase);
});

const mocks = { accessibleOwners, fromAccount, input, toAccount, transfer: transferMock };
const spies = {
  accountRepository: accountRepositoryMock,
  transferRepository: transferRepositoryMock,
};

export { mocks, setup, spies };
