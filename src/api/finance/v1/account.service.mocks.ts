import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { AccountService } from '@api/finance/v1/account.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateAccountUseCase } from '@finance/application/use-case/CreateAccountUseCase';
import { DeleteAccountUseCase } from '@finance/application/use-case/DeleteAccountUseCase';
import { GetAccountsUseCase } from '@finance/application/use-case/GetAccountsUseCase';
import { UpdateAccountUseCase } from '@finance/application/use-case/UpdateAccountUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const accountResultMock = {
  balance: 152075,
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  icon: 'bank',
  id: faker.string.uuid(),
  name: 'Checking',
  owner: OwnerType.USER,
  ownerId: userId,
  status: 'ACTIVE',
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};
const accountApiMock = {
  balance: 152075,
  createdAt: '2026-10-04T12:00:00.000Z',
  icon: 'bank',
  id: accountResultMock.id,
  name: 'Checking',
  owner: 'USER',
  ownerId: userId,
  status: 'ACTIVE',
  updatedAt: '2026-10-04T13:00:00.000Z',
};

const createAccountUseCaseMock = { execute: jest.fn().mockResolvedValue(accountResultMock) };
const deleteAccountUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getAccountsUseCaseMock = { execute: jest.fn().mockResolvedValue([accountResultMock]) };
const updateAccountUseCaseMock = { execute: jest.fn().mockResolvedValue(accountResultMock) };

// endregion Mocks

let setup: AccountService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      AccountService,
      { provide: CreateAccountUseCase, useValue: createAccountUseCaseMock },
      { provide: DeleteAccountUseCase, useValue: deleteAccountUseCaseMock },
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetAccountsUseCase, useValue: getAccountsUseCaseMock },
      { provide: UpdateAccountUseCase, useValue: updateAccountUseCaseMock },
    ],
  }).compile();

  setup = module.get(AccountService);
});

const mocks = {
  accessibleOwners,
  accountApi: accountApiMock,
  createAccountUseCase: createAccountUseCaseMock,
  deleteAccountUseCase: deleteAccountUseCaseMock,
  financeAccessService: financeAccessServiceMock,
  getAccountsUseCase: getAccountsUseCaseMock,
  updateAccountUseCase: updateAccountUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
