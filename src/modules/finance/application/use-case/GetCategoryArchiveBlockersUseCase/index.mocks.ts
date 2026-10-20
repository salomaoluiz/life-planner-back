import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetCategoryArchiveBlockersUseCase } from './index';

// region Mocks

const userId = 'user-id';
const otherId = 'other-family';
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const scopes = [...accessibleOwners, { owner: OwnerType.FAMILY, ownerId: otherId }];

function plan(months: (null | string)[], overrides: Record<string, unknown> = {}) {
  return {
    closingDay: 10,
    plan: {
      categoryId: 'c1',
      description: 'TV',
      id: 'plan-1',
      installments: months.map((invoiceMonth) => ({ invoiceMonth })),
      owner: OwnerType.USER,
      ownerId: userId,
      ...overrides,
    },
  };
}
function recurrence(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: 'c1',
    description: 'Gym',
    id: 'rec-1',
    nextOccurrenceDate: '2026-11-05',
    owner: OwnerType.USER,
    ownerId: userId,
    ...overrides,
  };
}

const recurrenceRepositoryMock = { findByOwners: jest.fn() };
const planRepositoryMock = { findPlansByCategoryIds: jest.fn() };

// endregion Mocks

let setup: GetCategoryArchiveBlockersUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  recurrenceRepositoryMock.findByOwners.mockResolvedValue([]);
  planRepositoryMock.findPlansByCategoryIds.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [
      GetCategoryArchiveBlockersUseCase,
      { provide: 'IFinanceRecurrenceRepository', useValue: recurrenceRepositoryMock },
      { provide: 'IFinanceInstallmentPlanRepository', useValue: planRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetCategoryArchiveBlockersUseCase);
});

const mocks = {
  accessibleOwners,
  input: { accessibleOwners, categoryIds: ['c1', 'c2'], scopes, today: '2026-10-20' },
  otherId,
  plan,
  planRepository: planRepositoryMock,
  recurrence,
  recurrenceRepository: recurrenceRepositoryMock,
};
const spies = {};

export { mocks, setup, spies };
