import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { FamilyService } from '@api/family/v1/family.service';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

// region Mocks

const userId = faker.string.uuid();
const familyResultMock = {
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  id: faker.string.uuid(),
  name: 'Example Family',
  ownerId: userId,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};
const familyApiMock = {
  createdAt: '2026-10-04T12:00:00.000Z',
  id: familyResultMock.id,
  name: 'Example Family',
  ownerId: userId,
  updatedAt: '2026-10-04T13:00:00.000Z',
};

const createFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const deleteFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const ensureFamilyOwnerUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const findUserByIdUseCaseMock = {
  execute: jest
    .fn()
    .mockResolvedValue({ email: 'test@example.com', id: userId, name: 'Test User' }),
};
const getFamilyByIdUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const getUserFamiliesUseCaseMock = { execute: jest.fn().mockResolvedValue([familyResultMock]) };
const updateFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const recordsCheckMock = { execute: jest.fn().mockResolvedValue(false) };

// endregion Mocks

let setup: FamilyService;

beforeEach(async () => {
  jest.clearAllMocks();
  recordsCheckMock.execute.mockResolvedValue(false);

  const module = await Test.createTestingModule({
    providers: [
      FamilyService,
      { provide: CreateFamilyUseCase, useValue: createFamilyUseCaseMock },
      { provide: DeleteFamilyUseCase, useValue: deleteFamilyUseCaseMock },
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: FindUserByIdUseCase, useValue: findUserByIdUseCaseMock },
      { provide: GetFamilyByIdUseCase, useValue: getFamilyByIdUseCaseMock },
      { provide: GetUserFamiliesUseCase, useValue: getUserFamiliesUseCaseMock },
      { provide: UpdateFamilyUseCase, useValue: updateFamilyUseCaseMock },
      { provide: FAMILY_OWNED_RECORDS_CHECKS, useValue: [recordsCheckMock] },
    ],
  }).compile();

  setup = module.get<FamilyService>(FamilyService);
});

const mocks = {
  createFamilyUseCase: createFamilyUseCaseMock,
  deleteFamilyUseCase: deleteFamilyUseCaseMock,
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  familyApi: familyApiMock,
  familyId: familyResultMock.id,
  findUserByIdUseCase: findUserByIdUseCaseMock,
  getFamilyByIdUseCase: getFamilyByIdUseCaseMock,
  getUserFamiliesUseCase: getUserFamiliesUseCaseMock,
  recordsCheck: recordsCheckMock,
  updateFamilyUseCase: updateFamilyUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
