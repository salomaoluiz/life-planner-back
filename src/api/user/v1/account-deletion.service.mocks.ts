import { Test } from '@nestjs/testing';

import { OWNED_RECORDS_PURGES } from '@api/user/v1/owned-records-purges';
import { GetOwnedFamilyIdsUseCase } from '@family/application/use-case/GetOwnedFamilyIdsUseCase';
import { RemoveUserFromFamiliesUseCase } from '@family/application/use-case/RemoveUserFromFamiliesUseCase';
import { ConfirmUserEmailUseCase } from '@user/application/use-case/ConfirmUserEmailUseCase';
import { DeleteUserUseCase } from '@user/application/use-case/DeleteUserUseCase';

import { AccountDeletionService } from './account-deletion.service';

// region Mocks

const userIdMock = 'user-id-123';
const confirmUserEmailMock = { execute: jest.fn() };
const deleteUserMock = { execute: jest.fn() };
const getOwnedFamilyIdsMock = { execute: jest.fn() };
const removeUserFromFamiliesMock = { execute: jest.fn() };
const loggerMock = { log: jest.fn() };
const purgesMock = {
  finance: { execute: jest.fn() },
  stock: { execute: jest.fn() },
};

// endregion Mocks

let setup: AccountDeletionService;

beforeEach(async () => {
  jest.clearAllMocks();
  confirmUserEmailMock.execute.mockResolvedValue({ email: 'test@example.com' });
  deleteUserMock.execute.mockResolvedValue(undefined);
  getOwnedFamilyIdsMock.execute.mockResolvedValue(['family-1', 'family-2']);
  removeUserFromFamiliesMock.execute.mockResolvedValue({ families: 2, memberships: 1 });
  purgesMock.finance.execute.mockResolvedValue(5);
  purgesMock.stock.execute.mockResolvedValue(5);

  const module = await Test.createTestingModule({
    providers: [
      AccountDeletionService,
      { provide: ConfirmUserEmailUseCase, useValue: confirmUserEmailMock },
      { provide: DeleteUserUseCase, useValue: deleteUserMock },
      { provide: GetOwnedFamilyIdsUseCase, useValue: getOwnedFamilyIdsMock },
      { provide: RemoveUserFromFamiliesUseCase, useValue: removeUserFromFamiliesMock },
      { provide: 'ILogger', useValue: loggerMock },
      {
        provide: OWNED_RECORDS_PURGES,
        useValue: [
          { module: 'finance', purge: purgesMock.finance },
          { module: 'stock', purge: purgesMock.stock },
        ],
      },
    ],
  }).compile();

  setup = module.get(AccountDeletionService);
});

const mocks = {
  confirmUserEmail: confirmUserEmailMock,
  deleteUser: deleteUserMock,
  getOwnedFamilyIds: getOwnedFamilyIdsMock,
  logger: loggerMock,
  purges: purgesMock,
  removeUserFromFamilies: removeUserFromFamiliesMock,
  userId: userIdMock,
};
const spies = {};

export { mocks, setup, spies };
