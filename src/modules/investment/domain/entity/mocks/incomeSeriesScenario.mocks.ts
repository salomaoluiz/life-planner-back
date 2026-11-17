import { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { IncomeSeriesGate } from '@investment/application/service/IncomeSeriesGate';
import { UpdateIncomeSeriesUseCase } from '@investment/application/use-case/UpdateIncomeSeriesUseCase';
import {
  incomeCategoryFixture,
  incomeFixture,
  incomeRepositorySpies,
  incomeSeriesFixture,
  incomeSeriesRepositorySpies,
} from '@investment/domain/entity/mocks/income.fixture';
import {
  assetFixture,
  operationFixture,
  repositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

// Spec 115: a REIT of the user with 100 shares bought on 2024-12-01, a BRL account, an income category and a monthly
// series (since 2025-01-15, 8 days ex-date offset, R$ 1,10 per share) created on 2026-11-12.
export const TODAY = '2026-11-12';

export async function buildSeriesUseCase<T>(
  useCase: Type<T>,
  spies: ReturnType<typeof wireSeriesSpies>,
): Promise<T> {
  const module = await Test.createTestingModule({
    providers: [
      useCase,
      { provide: 'IInvestmentRepository', useValue: spies.investment },
      { provide: 'IIncomeRepository', useValue: spies.incomes },
      { provide: 'IIncomeSeriesRepository', useValue: spies.series },
      { provide: IncomeSeriesGate, useValue: spies.gate },
      ...(useCase === (UpdateIncomeSeriesUseCase as Type<unknown>)
        ? []
        : [{ provide: UpdateIncomeSeriesUseCase, useValue: spies.updateSeries }]),
    ],
  }).compile();

  return module.get(useCase);
}
export function incomeSeriesScenario() {
  const owners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];
  const asset = assetFixture({
    assetClass: InvestmentAssetClass.BR_REIT,
    ownerId: 'user-1',
    ticker: 'HGLG11',
  });
  const buy = operationFixture({
    assetId: asset.id,
    date: '2024-12-01',
    quantity: Decimal8.parse('100'),
    type: InvestmentOperationType.BUY,
  });
  const detail = { ...asset, operations: [buy], valuations: [] };
  const account = {
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  };
  const category = incomeCategoryFixture();
  const series = incomeSeriesFixture({ assetId: asset.id });
  const income = incomeFixture({ assetId: asset.id, occurrenceNumber: 24, seriesId: series.id });

  return { account, asset, buy, category, detail, income, owners, series };
}
export function wireSeriesSpies(scenario: ReturnType<typeof incomeSeriesScenario>) {
  const investment = repositorySpies();
  const incomes = incomeRepositorySpies();
  const seriesRepository = incomeSeriesRepositorySpies();

  investment.findAssetById.mockResolvedValue(scenario.detail);
  investment.findAccountForOperation.mockResolvedValue(scenario.account);
  incomes.findCategoryById.mockResolvedValue(scenario.category);
  incomes.findIncomeById.mockResolvedValue(scenario.income);
  seriesRepository.createSeries.mockResolvedValue(scenario.series.id);
  seriesRepository.findById.mockResolvedValue(scenario.series);
  seriesRepository.findPlannedFrom.mockResolvedValue([]);
  seriesRepository.findActiveByOwners.mockResolvedValue([scenario.series]);
  seriesRepository.findAllActive.mockResolvedValue([scenario.series]);
  seriesRepository.findByAsset.mockResolvedValue([scenario.series]);

  return {
    gate: {
      invalidate: jest.fn(),
      runOnce: jest.fn(async (_owners: string[], _today: string, task: () => Promise<void>) =>
        task(),
      ),
    },
    incomes,
    investment,
    series: seriesRepository,
    updateSeries: { execute: jest.fn() },
  };
}
