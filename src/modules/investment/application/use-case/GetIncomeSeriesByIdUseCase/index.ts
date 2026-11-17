import { Inject, NotFoundException } from '@nestjs/common';

import {
  GetIncomeSeriesByIdInput,
  GetIncomeSeriesByIdSchema,
} from '@investment/application/dto/IncomeSeries';
import { loadReadableAsset } from '@investment/application/service/IncomeRules';
import { IncomeSeriesView, toSeriesView } from '@investment/application/service/IncomeSeriesRules';
import { IIncomeSeriesRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export class GetIncomeSeriesByIdUseCase implements UseCaseWithParams<
  GetIncomeSeriesByIdInput,
  IncomeSeriesView
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
  ) {}

  async execute(params: GetIncomeSeriesByIdInput): Promise<IncomeSeriesView> {
    const input = validate(GetIncomeSeriesByIdSchema, params);
    const series = await this.seriesRepository.findById(input.id);

    if (!series) {
      throw new NotFoundException();
    }

    await loadReadableAsset(this.investment, series.assetId, input.accessibleOwners);

    return toSeriesView(series);
  }
}
