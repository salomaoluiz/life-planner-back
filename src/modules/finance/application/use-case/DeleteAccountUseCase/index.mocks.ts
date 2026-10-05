import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { DeleteAccountUseCase } from './index';

// region Mocks

const accountMock = new AccountEntityFixture().build();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: accountMock.ownerId }];

const accountRepositoryMock = {
  deleteAccount: jest.fn().mockResolvedValue(undefined),
  findAccountById: jest.fn().mockResolvedValue(accountMock),
};

// endregion Mocks

const transactionRepositoryMock = { countByAccountId: jest.fn().mockResolvedValue(0) };

let setup: DeleteAccountUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(accountMock);
  transactionRepositoryMock.countByAccountId.mockResolvedValue(0);

  const module = await Test.createTestingModule({
    providers: [
      DeleteAccountUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
      { provide: 'IFinanceTransactionRepository', useValue: transactionRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteAccountUseCase);
});

const mocks = {
  accessibleOwners,
  account: accountMock,
  accountRepository: accountRepositoryMock,
  transactionRepository: transactionRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
