import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateAccountUseCase } from './index';

// region Mocks

const accountMock = new AccountEntityFixture().build();
const updatedMock = { ...accountMock, name: 'Renamed' };
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: accountMock.ownerId }];

const accountRepositoryMock = {
  findAccountById: jest.fn().mockResolvedValue(accountMock),
  updateAccount: jest.fn().mockResolvedValue(updatedMock),
};

// endregion Mocks

let setup: UpdateAccountUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(accountMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateAccountUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateAccountUseCase);
});

const mocks = {
  accessibleOwners,
  account: accountMock,
  accountRepository: accountRepositoryMock,
  updated: updatedMock,
};
const spies = {};

export { mocks, setup, spies };
