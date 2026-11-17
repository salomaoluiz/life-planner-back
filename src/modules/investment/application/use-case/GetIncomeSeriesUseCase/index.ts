import { Inject } from '@nestjs/common';

import {
  GetIncomeSeriesInput,
  GetIncomeSeriesSchema,
} from '@investment/application/dto/IncomeSeries';
import { loadReadableAsset } from '@investment/application/service/IncomeRules';
import { IncomeSeriesView, toSeriesView } from '@investment/application/service/IncomeSeriesRules';
import { IIncomeSeriesRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 115 section 7: the series of an asset, active first, then ended.
export class GetIncomeSeriesUseCase implements UseCaseWithParams<
  GetIncomeSeriesInput,
  IncomeSeriesView[]
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
  ) {}

  async execute(params: GetIncomeSeriesInput): Promise<IncomeSeriesView[]> {
    const input = validate(GetIncomeSeriesSchema, params);

    await loadReadableAsset(this.investment, input.assetId, input.accessibleOwners);

    return (await this.seriesRepository.findByAsset(input.assetId)).map((series) =>
      toSeriesView(series),
    );
  }
}
