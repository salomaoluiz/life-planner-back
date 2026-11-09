import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import TransferEntityFixture from '@finance/domain/entity/mocks/TransferEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetTransferUseCase } from './index';

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
const transferRepositoryMock = { findTransferById: jest.fn() };

let setup: GetTransferUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountsByIds.mockResolvedValue([fromAccount, toAccount]);
  transferRepositoryMock.findTransferById.mockResolvedValue(transfer);

  const module = await Test.createTestingModule({
    providers: [
      GetTransferUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceTransferRepository', useValue: transferRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetTransferUseCase);
});

const mocks = { accessibleOwners, fromAccount, toAccount, transfer };
const spies = { accountRepository: accountRepositoryMock, transferRepository: transferRepositoryMock };

export { mocks, setup, spies };
