import { Test } from '@nestjs/testing';

import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import TransferEntityFixture from '@finance/domain/entity/mocks/TransferEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteTransferUseCase } from './index';

// region Mocks

const fromAccount = new AccountEntityFixture().withId('acc-from').build();
const toAccount = new AccountEntityFixture().withId('acc-to').build();
const transfer = new TransferEntityFixture().withAccounts('acc-from', 'acc-to').build();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: fromAccount.ownerId },
  { owner: OwnerType.USER, ownerId: toAccount.ownerId },
];

// endregion Mocks

const accountRepositoryMock = { findAccountsByIds: jest.fn() };
const getTransferMock = { execute: jest.fn() };
const transferRepositoryMock = { deleteTransfer: jest.fn() };

let setup: DeleteTransferUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountsByIds.mockResolvedValue([fromAccount, toAccount]);
  getTransferMock.execute.mockResolvedValue(transfer);
  transferRepositoryMock.deleteTransfer.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      DeleteTransferUseCase,
      { provide: GetTransferUseCase, useValue: getTransferMock },
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceTransferRepository', useValue: transferRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteTransferUseCase);
});

const mocks = { accessibleOwners, transfer };
const spies = {
  accountRepository: accountRepositoryMock,
  getTransfer: getTransferMock,
  transferRepository: transferRepositoryMock,
};

export { mocks, setup, spies };
