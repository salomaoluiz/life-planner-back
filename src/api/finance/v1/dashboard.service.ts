import { Injectable } from '@nestjs/common';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { DashboardCommonInput } from '@finance/application/dto/GetDashboardRows';
import { GetBalanceSeriesUseCase } from '@finance/application/use-case/GetBalanceSeriesUseCase';
import { GetDashboardSummaryUseCase } from '@finance/application/use-case/GetDashboardSummaryUseCase';
import { GetFinanceTotalsUseCase } from '@finance/application/use-case/GetFinanceTotalsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { TransactionType } from '@finance/domain/enum';

// The request without the owners the caller can reach (resolved here, once per request).
export type DashboardRequest = Omit<DashboardCommonInput, 'accessibleOwners'>;

@Injectable()
export class DashboardService {
  constructor(
    private readonly financeAccessService: FinanceAccessService,
    private readonly getBalanceSeriesUseCase: GetBalanceSeriesUseCase,
    private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
    private readonly getFinanceTotalsUseCase: GetFinanceTotalsUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
  ) {}

  async getBalanceSeries(
    userId: string,
    request: DashboardRequest,
    granularity: 'DAY' | 'MONTH' | 'WEEK',
  ) {
    const accessibleOwners = await this.prepare(userId, request);

    return this.getBalanceSeriesUseCase.execute({ ...request, accessibleOwners, granularity });
  }

  async getSummary(userId: string, request: DashboardRequest) {
    const accessibleOwners = await this.prepare(userId, request);

    return this.getDashboardSummaryUseCase.execute({ ...request, accessibleOwners });
  }

  async getTotals(
    userId: string,
    request: DashboardRequest,
    totals: {
      groupBy: 'CATEGORY' | 'PERIOD' | 'TAG';
      parentId?: string;
      type?: keyof typeof TransactionType;
    },
  ) {
    const accessibleOwners = await this.prepare(userId, request);

    return this.getFinanceTotalsUseCase.execute({
      ...request,
      ...totals,
      accessibleOwners,
      type: totals.type === undefined ? undefined : TransactionType[totals.type],
    });
  }

  // Due recurring occurrences become real rows before anything is summed (spec 035 FR 17).
  private async prepare(userId: string, request: DashboardRequest) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      ownerIds: request.ownerIds,
      today: request.today,
    });

    return accessibleOwners;
  }
}
