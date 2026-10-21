import { Test } from '@nestjs/testing';

import { DashboardService } from '@api/finance/v1/dashboard.service';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { GetBalanceSeriesUseCase } from '@finance/application/use-case/GetBalanceSeriesUseCase';
import { GetDashboardSummaryUseCase } from '@finance/application/use-case/GetDashboardSummaryUseCase';
import { GetFinanceTotalsUseCase } from '@finance/application/use-case/GetFinanceTotalsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const accessibleOwners = [{ owner: OwnerType.USER, ownerId: 'user-1' }];
const request = {
  currency: 'BRL' as const,
  from: '2025-11-01',
  ownerIds: ['user-1'],
  to: '2026-10-31',
  today: '2026-10-20',
};
const accessMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const seriesMock = { execute: jest.fn().mockResolvedValue('series') };
const summaryMock = { execute: jest.fn().mockResolvedValue('summary') };
const totalsMock = { execute: jest.fn().mockResolvedValue('totals') };
const materializeMock = { execute: jest.fn().mockResolvedValue(undefined) };

async function build() {
  const module = await Test.createTestingModule({
    providers: [
      DashboardService,
      { provide: FinanceAccessService, useValue: accessMock },
      { provide: GetBalanceSeriesUseCase, useValue: seriesMock },
      { provide: GetDashboardSummaryUseCase, useValue: summaryMock },
      { provide: GetFinanceTotalsUseCase, useValue: totalsMock },
      { provide: MaterializeRecurrencesUseCase, useValue: materializeMock },
    ],
  }).compile();

  return module.get(DashboardService);
}

describe('DashboardService', () => {
  it('SHOULD materialize the recurrences before reading the summary', async () => {
    const setup = await build();

    expect(await setup.getSummary('user-1', request)).toBe('summary');
    expect(materializeMock.execute).toHaveBeenCalledWith({
      accessibleOwners,
      ownerIds: ['user-1'],
      today: '2026-10-20',
    });
    expect(summaryMock.execute).toHaveBeenCalledWith({ ...request, accessibleOwners });
  });

  it('SHOULD add the granularity to the balance series', async () => {
    const setup = await build();

    expect(await setup.getBalanceSeries('user-1', request, 'WEEK')).toBe('series');
    expect(seriesMock.execute).toHaveBeenCalledWith({
      ...request,
      accessibleOwners,
      granularity: 'WEEK',
    });
  });

  it('SHOULD convert the type of the totals to the domain enum', async () => {
    const setup = await build();

    expect(await setup.getTotals('user-1', request, { groupBy: 'TAG', type: 'INCOME' })).toBe(
      'totals',
    );
    expect(totalsMock.execute).toHaveBeenCalledWith({
      ...request,
      accessibleOwners,
      groupBy: 'TAG',
      type: TransactionType.INCOME,
    });
    await setup.getTotals('user-1', request, { groupBy: 'PERIOD' });
    expect(totalsMock.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: undefined }),
    );
  });
});
