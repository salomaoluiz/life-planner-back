import { Test } from '@nestjs/testing';

import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetAccountsByIdsUseCase } from './index';

// region Mocks

const ownAccountMock = new AccountEntityFixture().withOwner(OwnerType.USER).build();
const otherAccountMock = new AccountEntityFixture().withOwner(OwnerType.USER).build();
const accessibleOwnersMock = [{ owner: OwnerType.USER, ownerId: ownAccountMock.ownerId }];
const accountRepositoryMock = {
  findAccountsByIds: jest.fn().mockResolvedValue([ownAccountMock, otherAccountMock]),
};

// endregion Mocks

let setup: GetAccountsByIdsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetAccountsByIdsUseCase,
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetAccountsByIdsUseCase);
});

const mocks = {
  accessibleOwners: accessibleOwnersMock,
  accountRepository: accountRepositoryMock,
  other: otherAccountMock,
  own: ownAccountMock,
};
const spies = {};

export { mocks, setup, spies };
