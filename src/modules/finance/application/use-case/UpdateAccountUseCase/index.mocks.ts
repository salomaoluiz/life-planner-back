import { Test } from '@nestjs/testing';

import { AttachAccountBalancesUseCase } from '@finance/application/use-case/AttachAccountBalancesUseCase';
import { EndRecurrencesBySourceUseCase } from '@finance/application/use-case/EndRecurrencesBySourceUseCase';
import AccountEntityFixture from '@finance/domain/entity/mocks/AccountEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { UpdateAccountUseCase } from './index';

// region Mocks

const accountMock = new AccountEntityFixture().build();
const updatedMock = { ...accountMock, name: 'Renamed' };
const withBalancesMock = { account: updatedMock, balance: 100, projectedBalance: 120 };
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: accountMock.ownerId }];

const accountRepositoryMock = {
  findAccountById: jest.fn().mockResolvedValue(accountMock),
  updateAccount: jest.fn().mockResolvedValue(updatedMock),
};
const attachMock = { execute: jest.fn() };
const endRecurrencesMock = { execute: jest.fn().mockResolvedValue(0) };

// endregion Mocks

let setup: UpdateAccountUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  accountRepositoryMock.findAccountById.mockResolvedValue(accountMock);
  attachMock.execute.mockResolvedValue([withBalancesMock]);

  const module = await Test.createTestingModule({
    providers: [
      UpdateAccountUseCase,
      { provide: AttachAccountBalancesUseCase, useValue: attachMock },
      { provide: EndRecurrencesBySourceUseCase, useValue: endRecurrencesMock },
      { provide: 'IFinanceAccountRepository', useValue: accountRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateAccountUseCase);
});

const mocks = {
  accessibleOwners,
  account: accountMock,
  accountRepository: accountRepositoryMock,
  attach: attachMock,
  endRecurrences: endRecurrencesMock,
  updated: updatedMock,
  withBalances: withBalancesMock,
};
const spies = {};

export { mocks, setup, spies };
