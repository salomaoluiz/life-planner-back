import { Test } from '@nestjs/testing';

import { OWNED_RECORDS_PURGES } from '@api/user/v1/owned-records-purges';
import { GetOwnedFamilyIdsUseCase } from '@family/application/use-case/GetOwnedFamilyIdsUseCase';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { RemoveUserFromFamiliesUseCase } from '@family/application/use-case/RemoveUserFromFamiliesUseCase';
import { DetachCategoryCreatorFromFamilyUseCase } from '@finance/application/use-case/DetachCategoryCreatorFromFamilyUseCase';
import { DetachTagCreatorFromFamilyUseCase } from '@finance/application/use-case/DetachTagCreatorFromFamilyUseCase';
import { ConfirmUserEmailUseCase } from '@user/application/use-case/ConfirmUserEmailUseCase';
import { DeleteUserUseCase } from '@user/application/use-case/DeleteUserUseCase';

import { AccountDeletionService } from './account-deletion.service';

// region Mocks

const userIdMock = 'user-id-123';
const confirmUserEmailMock = { execute: jest.fn() };
const deleteUserMock = { execute: jest.fn() };
const detachCategoryCreatorMock = { execute: jest.fn() };
const detachTagCreatorMock = { execute: jest.fn() };
const getOwnedFamilyIdsMock = { execute: jest.fn() };
const getUserFamilyIdsMock = { execute: jest.fn() };
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
  detachCategoryCreatorMock.execute.mockResolvedValue(0);
  detachTagCreatorMock.execute.mockResolvedValue(0);
  getUserFamilyIdsMock.execute.mockResolvedValue(['family-1', 'family-3']);
  getOwnedFamilyIdsMock.execute.mockResolvedValue(['family-1', 'family-2']);
  removeUserFromFamiliesMock.execute.mockResolvedValue({ families: 2, memberships: 1 });
  purgesMock.finance.execute.mockResolvedValue(5);
  purgesMock.stock.execute.mockResolvedValue(5);

  const module = await Test.createTestingModule({
    providers: [
      AccountDeletionService,
      { provide: ConfirmUserEmailUseCase, useValue: confirmUserEmailMock },
      { provide: DeleteUserUseCase, useValue: deleteUserMock },
      { provide: DetachCategoryCreatorFromFamilyUseCase, useValue: detachCategoryCreatorMock },
      { provide: DetachTagCreatorFromFamilyUseCase, useValue: detachTagCreatorMock },
      { provide: GetOwnedFamilyIdsUseCase, useValue: getOwnedFamilyIdsMock },
      { provide: GetUserFamilyIdsUseCase, useValue: getUserFamilyIdsMock },
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
  detachCategoryCreator: detachCategoryCreatorMock,
  detachTagCreator: detachTagCreatorMock,
  getOwnedFamilyIds: getOwnedFamilyIdsMock,
  getUserFamilyIds: getUserFamilyIdsMock,
  logger: loggerMock,
  purges: purgesMock,
  removeUserFromFamilies: removeUserFromFamiliesMock,
  userId: userIdMock,
};
const spies = {};

export { mocks, setup, spies };
