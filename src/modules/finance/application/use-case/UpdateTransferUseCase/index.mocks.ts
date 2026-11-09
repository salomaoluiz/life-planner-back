import { Test } from '@nestjs/testing';

import { MaterializationGate } from '@finance/application/service/MaterializationGate';
import { GetTransferUseCase } from '@finance/application/use-case/GetTransferUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import TransferEntityFixture from '@finance/domain/entity/mocks/TransferEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateTransferUseCase } from './index';

// region Mocks

const fromAccount = new AccountEntityFixture().withId('acc-from').build();
const toAccount = new AccountEntityFixture().withId('acc-to').build();
const otherAccount = new AccountEntityFixture().withId('acc-other').build();
const transfer = new TransferEntityFixture().withAccounts('acc-from', 'acc-to').build();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: fromAccount.ownerId },
  { owner: OwnerType.USER, ownerId: toAccount.ownerId },
  { owner: OwnerType.USER, ownerId: otherAccount.ownerId },
];

// endregion Mocks

const accountRepositoryMock = { findAccountsByIds: jest.fn() };
const getTransferMock = { execute: jest.fn() };
const gateMock = { invalidate: jest.fn() };
const transferRepositoryMock = {
  findSeriesTransfersFrom: jest.fn(),
  updateSeriesTemplate: jest.fn(),
  updateTransfer: jest.fn(),
};

let setup: UpdateTransferUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountsByIds.mockImplementation(async (ids: string[]) =>
    [fromAccount, toAccount, otherAccount].filter((account) => ids.includes(account.id)),
  );
  getTransferMock.execute.mockResolvedValue(transfer);
  transferRepositoryMock.updateTransfer.mockResolvedValue(transfer);
  transferRepositoryMock.findSeriesTransfersFrom.mockResolvedValue([]);
  transferRepositoryMock.updateSeriesTemplate.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      UpdateTransferUseCase,
      { provide: GetTransferUseCase, useValue: getTransferMock },
      { provide: MaterializationGate, useValue: gateMock },
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceTransferRepository', useValue: transferRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateTransferUseCase);
});

const mocks = { accessibleOwners, fromAccount, otherAccount, toAccount, transfer };
const spies = {
  accountRepository: accountRepositoryMock,
  gate: gateMock,
  getTransfer: getTransferMock,
  transferRepository: transferRepositoryMock,
};

export { mocks, setup, spies };
