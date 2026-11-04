import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { MonthService } from '@api/finance/v1/month.service';
import { GetDailyBalancesUseCase } from '@finance/application/use-case/GetDailyBalancesUseCase';
import { GetInvoicesForListUseCase } from '@finance/application/use-case/GetInvoicesForListUseCase';
import { GetMonthSummaryUseCase } from '@finance/application/use-case/GetMonthSummaryUseCase';
import { GetProjectionsUseCase } from '@finance/application/use-case/GetProjectionsUseCase';
import { GetTransactionsUseCase } from '@finance/application/use-case/GetTransactionsUseCase';
import { LoadFilterCategoriesUseCase } from '@finance/application/use-case/LoadFilterCategoriesUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const rowMock = new TransactionEntityFixture().withDate('2026-11-10').build();
const summaryMock = {
  currency: 'BRL',
  expense: 10,
  income: 20,
  projectedExpense: 0,
  projectedIncome: 0,
  toPay: 0,
  toReceive: 0,
};
const dailyResultMock = { accounts: [], days: [], month: '2026-11' };

const financeAccessServiceMock = { resolve: jest.fn() };
const getDailyBalancesUseCaseMock = { execute: jest.fn() };
const getInvoicesForListUseCaseMock = { execute: jest.fn() };
const getMonthSummaryUseCaseMock = { execute: jest.fn() };
const getProjectionsUseCaseMock = { execute: jest.fn() };
const getTransactionsUseCaseMock = { execute: jest.fn() };
const loadFilterCategoriesUseCaseMock = { execute: jest.fn() };
const materializeRecurrencesUseCaseMock = { execute: jest.fn() };

// endregion Mocks

let setup: MonthService;

beforeEach(async () => {
  jest.resetAllMocks();
  financeAccessServiceMock.resolve.mockResolvedValue(accessibleOwners);
  getDailyBalancesUseCaseMock.execute.mockResolvedValue(dailyResultMock);
  getInvoicesForListUseCaseMock.execute.mockResolvedValue([]);
  getMonthSummaryUseCaseMock.execute.mockResolvedValue(summaryMock);
  getProjectionsUseCaseMock.execute.mockResolvedValue([]);
  getTransactionsUseCaseMock.execute.mockResolvedValue({ items: [rowMock], nextCursor: null });
  loadFilterCategoriesUseCaseMock.execute.mockResolvedValue(undefined);
  materializeRecurrencesUseCaseMock.execute.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      MonthService,
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetDailyBalancesUseCase, useValue: getDailyBalancesUseCaseMock },
      { provide: GetInvoicesForListUseCase, useValue: getInvoicesForListUseCaseMock },
      { provide: GetMonthSummaryUseCase, useValue: getMonthSummaryUseCaseMock },
      { provide: GetProjectionsUseCase, useValue: getProjectionsUseCaseMock },
      { provide: GetTransactionsUseCase, useValue: getTransactionsUseCaseMock },
      { provide: LoadFilterCategoriesUseCase, useValue: loadFilterCategoriesUseCaseMock },
      { provide: MaterializeRecurrencesUseCase, useValue: materializeRecurrencesUseCaseMock },
    ],
  }).compile();

  setup = module.get(MonthService);
});

const mocks = {
  accessibleOwners,
  financeAccessService: financeAccessServiceMock,
  getDailyBalancesUseCase: getDailyBalancesUseCaseMock,
  getInvoicesForListUseCase: getInvoicesForListUseCaseMock,
  getMonthSummaryUseCase: getMonthSummaryUseCaseMock,
  getProjectionsUseCase: getProjectionsUseCaseMock,
  getTransactionsUseCase: getTransactionsUseCaseMock,
  loadFilterCategoriesUseCase: loadFilterCategoriesUseCaseMock,
  materializeRecurrencesUseCase: materializeRecurrencesUseCaseMock,
  row: rowMock,
  summary: summaryMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
