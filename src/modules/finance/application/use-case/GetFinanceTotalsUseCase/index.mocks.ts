import { Test } from '@nestjs/testing';

import {
  DashboardRow,
  GetDashboardRowsUseCase,
} from '@finance/application/use-case/GetDashboardRowsUseCase';
import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import TagEntityFixture from '@finance/domain/entity/mocks/TagEntity.fixture';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { GetFinanceTotalsUseCase } from './index';

// region Mocks

const ownerId = 'user-a';
const inputMock = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId }],
  currency: 'BRL' as const,
  from: '2025-11-01',
  to: '2026-10-31',
  today: '2026-10-20',
};
const housing = new CategoryEntityFixture().withId('housing').withName('Housing').build();
const rent = new CategoryEntityFixture()
  .withId('rent')
  .withName('Rent')
  .withParentId('housing')
  .withStatus('ARCHIVED' as never)
  .build();
const food = new CategoryEntityFixture().withId('food').withName('Food').build();
const tagFixed = new TagEntityFixture().withId('tag-fixed').withName('fixed').build();

const categoryRepositoryMock = { findCategories: jest.fn() };
const rowsMock = { execute: jest.fn() };
const tagRepositoryMock = { findTags: jest.fn() };

function rowOf(overrides: Partial<DashboardRow>): DashboardRow {
  return {
    amount: 1000,
    bucketDate: '2026-10-05',
    categoryId: 'food',
    count: 1,
    projected: false,
    tagId: null,
    type: TransactionType.EXPENSE,
    ...overrides,
  };
}

// endregion Mocks

let setup: GetFinanceTotalsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  categoryRepositoryMock.findCategories.mockResolvedValue([housing, rent, food]);
  rowsMock.execute.mockResolvedValue([]);
  tagRepositoryMock.findTags.mockResolvedValue([tagFixed]);

  const module = await Test.createTestingModule({
    providers: [
      GetFinanceTotalsUseCase,
      { provide: 'IFinanceCategoryRepository', useValue: categoryRepositoryMock },
      { provide: 'IFinanceTagRepository', useValue: tagRepositoryMock },
      { provide: GetDashboardRowsUseCase, useValue: rowsMock },
    ],
  }).compile();

  setup = module.get(GetFinanceTotalsUseCase);
});

const mocks = { input: inputMock, rowOf, rows: rowsMock };

export { mocks, setup };
