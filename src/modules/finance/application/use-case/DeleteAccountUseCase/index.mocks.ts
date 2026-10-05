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

let setup: DeleteAccountUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(accountMock);

  const module = await Test.createTestingModule({
    providers: [
      DeleteAccountUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteAccountUseCase);
});

const mocks = { account: accountMock, accessibleOwners, accountRepository: accountRepositoryMock };
const spies = {};

export { mocks, setup, spies };
