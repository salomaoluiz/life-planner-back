import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';

// region Mocks

const userId = faker.string.uuid();
const familyIds = [faker.string.uuid(), faker.string.uuid()];

const getUserFamilyIdsUseCaseMock = { execute: jest.fn().mockResolvedValue(familyIds) };

// endregion Mocks

let setup: FinanceAccessService;

beforeEach(async () => {
  jest.clearAllMocks();
  getUserFamilyIdsUseCaseMock.execute.mockResolvedValue(familyIds);

  const module = await Test.createTestingModule({
    providers: [
      FinanceAccessService,
      { provide: GetUserFamilyIdsUseCase, useValue: getUserFamilyIdsUseCaseMock },
    ],
  }).compile();

  setup = module.get(FinanceAccessService);
});

const mocks = { familyIds, getUserFamilyIdsUseCase: getUserFamilyIdsUseCaseMock, userId };
const spies = {};

export { mocks, setup, spies };
