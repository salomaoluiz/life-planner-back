import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FAMILY_OWNED_RECORDS_CHECKS } from '@api/family/v1/family-records-checks';
import { FamilyService } from '@api/family/v1/family.service';
import { CreateFamilyUseCase } from '@family/application/use-case/CreateFamilyUseCase';
import { DeleteFamilyUseCase } from '@family/application/use-case/DeleteFamilyUseCase';
import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import { GetFamilyPendingInvitesUseCase } from '@family/application/use-case/GetFamilyPendingInvitesUseCase';
import { GetUserFamiliesUseCase } from '@family/application/use-case/GetUserFamiliesUseCase';
import { UpdateFamilyUseCase } from '@family/application/use-case/UpdateFamilyUseCase';
import { FamilyStatus } from '@family/domain/enum';
import { AddFamilyToCategoryScopesUseCase } from '@finance/application/use-case/AddFamilyToCategoryScopesUseCase';
import { AddFamilyToTagScopesUseCase } from '@finance/application/use-case/AddFamilyToTagScopesUseCase';
import { GetFamilyArchiveBlockersUseCase } from '@finance/application/use-case/GetFamilyArchiveBlockersUseCase';
import { RemoveFamilyFromCategoryScopesUseCase } from '@finance/application/use-case/RemoveFamilyFromCategoryScopesUseCase';
import { RemoveFamilyFromTagScopesUseCase } from '@finance/application/use-case/RemoveFamilyFromTagScopesUseCase';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

// region Mocks

const userId = faker.string.uuid();
const familyResultMock = {
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  id: faker.string.uuid(),
  name: 'Example Family',
  ownerId: userId,
  status: FamilyStatus.ACTIVE,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};
const familyApiMock = {
  createdAt: '2026-10-04T12:00:00.000Z',
  id: familyResultMock.id,
  name: 'Example Family',
  ownerId: userId,
  status: 'ACTIVE',
  updatedAt: '2026-10-04T13:00:00.000Z',
};

const addFamilyToCategoryScopesMock = { execute: jest.fn().mockResolvedValue(undefined) };
const addFamilyToTagScopesMock = { execute: jest.fn().mockResolvedValue(undefined) };
const removeFamilyFromTagScopesMock = { execute: jest.fn().mockResolvedValue(undefined) };
const removeFamilyFromCategoryScopesMock = { execute: jest.fn().mockResolvedValue(undefined) };
const createFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const deleteFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const ensureFamilyOwnerUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const findUserByIdUseCaseMock = {
  execute: jest
    .fn()
    .mockResolvedValue({ email: 'test@example.com', id: userId, name: 'Test User' }),
};
const noBlockers = {
  counts: { installmentPlans: 0, invoices: 0, recurrences: 0, unpaidTransactions: 0 },
  installmentPlans: [],
  invoices: [],
  recurrences: [],
  unpaidTransactions: [],
};
const getFamilyArchiveBlockersUseCaseMock = { execute: jest.fn().mockResolvedValue(noBlockers) };
const getFamilyPendingInvitesUseCaseMock = { execute: jest.fn().mockResolvedValue([]) };
const getFamilyByIdUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const getUserFamiliesUseCaseMock = { execute: jest.fn().mockResolvedValue([familyResultMock]) };
const updateFamilyUseCaseMock = { execute: jest.fn().mockResolvedValue(familyResultMock) };
const recordsCheckMock = { execute: jest.fn().mockResolvedValue(false) };

// endregion Mocks

let setup: FamilyService;

beforeEach(async () => {
  jest.clearAllMocks();
  recordsCheckMock.execute.mockResolvedValue(false);
  getFamilyArchiveBlockersUseCaseMock.execute.mockResolvedValue(noBlockers);
  getFamilyPendingInvitesUseCaseMock.execute.mockResolvedValue([]);
  ensureFamilyOwnerUseCaseMock.execute.mockResolvedValue(familyResultMock);

  const module = await Test.createTestingModule({
    providers: [
      FamilyService,
      { provide: AddFamilyToCategoryScopesUseCase, useValue: addFamilyToCategoryScopesMock },
      { provide: AddFamilyToTagScopesUseCase, useValue: addFamilyToTagScopesMock },
      { provide: RemoveFamilyFromTagScopesUseCase, useValue: removeFamilyFromTagScopesMock },
      {
        provide: RemoveFamilyFromCategoryScopesUseCase,
        useValue: removeFamilyFromCategoryScopesMock,
      },
      { provide: CreateFamilyUseCase, useValue: createFamilyUseCaseMock },
      { provide: DeleteFamilyUseCase, useValue: deleteFamilyUseCaseMock },
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: FindUserByIdUseCase, useValue: findUserByIdUseCaseMock },
      { provide: GetFamilyArchiveBlockersUseCase, useValue: getFamilyArchiveBlockersUseCaseMock },
      { provide: GetFamilyByIdUseCase, useValue: getFamilyByIdUseCaseMock },
      { provide: GetFamilyPendingInvitesUseCase, useValue: getFamilyPendingInvitesUseCaseMock },
      { provide: GetUserFamiliesUseCase, useValue: getUserFamiliesUseCaseMock },
      { provide: UpdateFamilyUseCase, useValue: updateFamilyUseCaseMock },
      { provide: FAMILY_OWNED_RECORDS_CHECKS, useValue: [recordsCheckMock] },
    ],
  }).compile();

  setup = module.get<FamilyService>(FamilyService);
});

const mocks = {
  addFamilyToCategoryScopes: addFamilyToCategoryScopesMock,
  addFamilyToTagScopes: addFamilyToTagScopesMock,
  createFamilyUseCase: createFamilyUseCaseMock,
  deleteFamilyUseCase: deleteFamilyUseCaseMock,
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  familyApi: familyApiMock,
  familyId: familyResultMock.id,
  familyResult: familyResultMock,
  findUserByIdUseCase: findUserByIdUseCaseMock,
  getFamilyArchiveBlockersUseCase: getFamilyArchiveBlockersUseCaseMock,
  getFamilyByIdUseCase: getFamilyByIdUseCaseMock,
  getFamilyPendingInvitesUseCase: getFamilyPendingInvitesUseCaseMock,
  getUserFamiliesUseCase: getUserFamiliesUseCaseMock,
  noBlockers,
  recordsCheck: recordsCheckMock,
  removeFamilyFromCategoryScopes: removeFamilyFromCategoryScopesMock,
  removeFamilyFromTagScopes: removeFamilyFromTagScopesMock,
  updateFamilyUseCase: updateFamilyUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
