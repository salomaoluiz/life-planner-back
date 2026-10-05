import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { CreateAccountUseCase } from './index';

// region Mocks

const accountMock = new AccountEntityFixture().build();
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: accountMock.ownerId }],
  balance: 152075,
  icon: 'bank',
  name: 'Checking',
  owner: OwnerType.USER,
  ownerId: accountMock.ownerId,
};

const accountRepositoryMock = { createAccount: jest.fn().mockResolvedValue(accountMock) };

// endregion Mocks

let setup: CreateAccountUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreateAccountUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateAccountUseCase);
});

const mocks = { account: accountMock, accountRepository: accountRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
