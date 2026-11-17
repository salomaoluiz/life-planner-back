import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { RefreshIncomeSeriesUseCase } from '@investment/application/use-case/RefreshIncomeSeriesUseCase';
import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IScheduler } from '@shared/infra/scheduler/types';

// Spec 115 FR 18: day 1 of every month at 00:10 São Paulo time creates the planned occurrences of the new month.
export const INCOME_SERIES_SCHEDULE = {
  cron: '0 10 0 1 * *',
  name: 'income-series',
  timeZone: 'America/Sao_Paulo',
};

// `INVESTMENT_INCOME_SERIES_JOB_ENABLED=false` turns it off (reads still materialize what is missing).
@Injectable()
export class RefreshIncomeSeriesJob implements OnModuleInit {
  constructor(
    @Inject('IScheduler') private readonly scheduler: IScheduler,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
    private readonly refresh: RefreshIncomeSeriesUseCase,
  ) {}

  onModuleInit(): void {
    if (!this.env.investmentIncomeSeriesJobEnabled) {
      this.logger.log(LogLevel.INFO, 'Income series job is disabled', {
        module: 'RefreshIncomeSeriesJob',
      });

      return;
    }

    this.scheduler.cron(
      INCOME_SERIES_SCHEDULE.name,
      INCOME_SERIES_SCHEDULE.cron,
      INCOME_SERIES_SCHEDULE.timeZone,
      async () => {
        await this.refresh.execute();
      },
    );
  }
}
