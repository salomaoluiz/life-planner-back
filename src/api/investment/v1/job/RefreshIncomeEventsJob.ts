import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { RefreshCorporateEventsUseCase } from '@investment/application/use-case/RefreshCorporateEventsUseCase';
import { RefreshIncomeEventsUseCase } from '@investment/application/use-case/RefreshIncomeEventsUseCase';
import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IScheduler } from '@shared/infra/scheduler/types';

// Spec 107 FR 24, weekdays 19:00 São Paulo time, after the 104 B3 close run at 18:30.
export const INCOME_EVENTS_SCHEDULE = {
  cron: '0 0 19 * * 1-5',
  name: 'income-events',
  timeZone: 'America/Sao_Paulo',
};

// The only path that asks the providers for announced income and, since spec 108, corporate events (the second step
// runs right after, and a failing step never stops the other). `INVESTMENT_QUOTES_JOB_ENABLED=false` turns it off.
@Injectable()
export class RefreshIncomeEventsJob implements OnModuleInit {
  constructor(
    @Inject('IScheduler') private readonly scheduler: IScheduler,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly env: EnvService,
    private readonly refresh: RefreshIncomeEventsUseCase,
    private readonly refreshCorporate: RefreshCorporateEventsUseCase,
  ) {}

  onModuleInit(): void {
    if (!this.env.investmentQuotesJobEnabled) {
      this.logger.log(LogLevel.INFO, 'Investment income events job is disabled', {
        module: 'RefreshIncomeEventsJob',
      });

      return;
    }

    this.scheduler.cron(
      INCOME_EVENTS_SCHEDULE.name,
      INCOME_EVENTS_SCHEDULE.cron,
      INCOME_EVENTS_SCHEDULE.timeZone,
      async () => {
        await this.refreshBoth();
      },
    );
  }

  private async refreshBoth(): Promise<void> {
    let failure: unknown;

    try {
      await this.refresh.execute();
    } catch (error) {
      failure = error;
    }

    try {
      await this.refreshCorporate.execute();
    } catch (error) {
      failure ??= error;
    }

    if (failure) {
      throw failure;
    }
  }
}
