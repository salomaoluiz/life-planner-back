import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';

// region Mocks

const userId = faker.string.uuid();
const familyIds = [faker.string.uuid(), faker.string.uuid()];
const families = [
  { archived: false, familyId: familyIds[0] },
  { archived: true, familyId: familyIds[1] },
];

const getUserFamilyAccessUseCaseMock = { execute: jest.fn().mockResolvedValue(families) };

// endregion Mocks

let setup: FinanceAccessService;

beforeEach(async () => {
  jest.clearAllMocks();
  getUserFamilyAccessUseCaseMock.execute.mockResolvedValue(families);

  const module = await Test.createTestingModule({
    providers: [
      FinanceAccessService,
      { provide: GetUserFamilyAccessUseCase, useValue: getUserFamilyAccessUseCaseMock },
    ],
  }).compile();

  setup = module.get(FinanceAccessService);
});

const mocks = { familyIds, getUserFamilyAccessUseCase: getUserFamilyAccessUseCaseMock, userId };
const spies = {};

export { mocks, setup, spies };
