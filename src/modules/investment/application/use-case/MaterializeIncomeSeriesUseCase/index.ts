import { Inject } from '@nestjs/common';

import {
  MaterializeIncomeSeriesInput,
  MaterializeIncomeSeriesSchema,
} from '@investment/application/dto/IncomeSeries';
import { IncomeSeriesGate } from '@investment/application/service/IncomeSeriesGate';
import { materializeDueSeries } from '@investment/application/service/IncomeSeriesMaterializer';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IIncomeSeriesRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 115 FR 18-19: creates the missing planned occurrences (up to the end of `today`'s month) of every active series
// of these owners. Idempotent and safe under concurrent reads (the datasource locks the series row).
export class MaterializeIncomeSeriesUseCase implements UseCaseWithParams<
  MaterializeIncomeSeriesInput,
  void
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
    @Inject(IncomeSeriesGate) private readonly gate: IncomeSeriesGate,
  ) {}

  async execute(params: MaterializeIncomeSeriesInput): Promise<void> {
    const input = validate(MaterializeIncomeSeriesSchema, params);
    // Never write rows for an archived family (spec 042 FR 10).
    const owners = input.accessibleOwners.filter(
      (access) => !access.archived && (!input.ownerIds || input.ownerIds.includes(access.ownerId)),
    );

    if (owners.length === 0) {
      return;
    }

    await this.gate.runOnce(
      owners.map((access) => access.ownerId),
      input.today,
      async () => this.run(owners, input.today),
    );
  }

  private async run(owners: OwnerAccess[], today: string): Promise<void> {
    await materializeDueSeries(
      this.investment,
      this.seriesRepository,
      await this.seriesRepository.findActiveByOwners(owners),
      today,
    );
  }
}
