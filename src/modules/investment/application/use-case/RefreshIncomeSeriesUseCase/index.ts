import { Inject } from '@nestjs/common';

import { materializeDueSeries } from '@investment/application/service/IncomeSeriesMaterializer';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import {
  IIncomeRepository,
  IIncomeSeriesRepository,
  IInvestmentRepository,
} from '@investment/domain/repository';
import { UseCase } from '@shared/application/use-case/types';

const LOCK_KEY = 115001;

export interface RefreshIncomeSeriesResult {
  skipped: boolean;
}

// Spec 115 FR 18: the monthly job (day 1, 00:10 São Paulo). No user: it touches only active series, under an advisory
// lock so two instances never run it together.
export class RefreshIncomeSeriesUseCase implements UseCase<RefreshIncomeSeriesResult> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
  ) {}

  async execute(): Promise<RefreshIncomeSeriesResult> {
    const ran = await this.incomes.runExclusive(LOCK_KEY, async () => {
      await materializeDueSeries(
        this.investment,
        this.seriesRepository,
        await this.seriesRepository.findAllActive(),
        todayInSaoPaulo(),
      );
    });

    return { skipped: !ran };
  }
}
