import { Inject, Injectable } from '@nestjs/common';

import {
  GetMarketIndexesInput,
  GetMarketIndexesSchema,
} from '@investment/application/dto/MarketIndex';
import {
  buildSummary,
  changeDateOf,
  MarketIndexesSummary,
} from '@investment/application/service/MarketIndexView';
import { MarketIndexSeries } from '@investment/domain/enum';
import { IMarketIndexRepository } from '@investment/domain/repository';
import { addDays } from '@investment/domain/service/MarketDate';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// How far back the "last change" of the annual CDI and the Selic target is looked for.
const CHANGE_LOOKBACK_DAYS = 5 * 366;

// Spec 113 FR 17: stored values only (the app never waits for the Central Bank, FR 8).
@Injectable()
export class GetMarketIndexesUseCase implements UseCaseWithParams<
  GetMarketIndexesInput,
  MarketIndexesSummary
> {
  constructor(
    @Inject('IMarketIndexRepository')
    private readonly indexes: IMarketIndexRepository,
  ) {}

  async execute(params: GetMarketIndexesInput): Promise<MarketIndexesSummary> {
    const input = validate(GetMarketIndexesSchema, params);
    const from = addDays(input.today, -CHANGE_LOOKBACK_DAYS);
    const [latest, fetches, fx, followers, cdiRows, selicRows] = await Promise.all([
      this.indexes.findLatest(),
      this.indexes.findFetches(),
      this.indexes.findFxPairs(),
      this.indexes.findFollowers(input.accessibleOwners, input.today),
      this.indexes.findHistory(MarketIndexSeries.CDI_ANNUAL, from, input.today),
      this.indexes.findHistory(MarketIndexSeries.SELIC_TARGET, from, input.today),
    ]);

    return buildSummary({
      changeDates: { cdi: changeDateOf(cdiRows), selic: changeDateOf(selicRows) },
      fetches,
      followers,
      fx,
      latest,
      today: input.today,
    });
  }
}
