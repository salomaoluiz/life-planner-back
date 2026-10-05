import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { AccountController } from '@api/finance/v1/account.controller';
import { AccountService } from '@api/finance/v1/account.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const accountApiMock = {
  balance: 152075,
  createdAt: '2026-10-04T12:00:00.000Z',
  icon: 'bank',
  id: faker.string.uuid(),
  name: 'Checking',
  owner: 'USER',
  ownerId: userId,
  status: 'ACTIVE',
  updatedAt: '2026-10-04T12:00:00.000Z',
};
const requestMock = { user: { id: userId } } as JwtPayload & Request;

const accountServiceMock = {
  create: jest.fn().mockResolvedValue(accountApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([accountApiMock]),
  update: jest.fn().mockResolvedValue(accountApiMock),
};

// endregion Mocks

let setup: AccountController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [AccountController],
    providers: [{ provide: AccountService, useValue: accountServiceMock }],
  }).compile();

  setup = module.get(AccountController);
});

const mocks = { account: accountApiMock, accountService: accountServiceMock, request: requestMock };
const spies = {};

export { mocks, setup, spies };
