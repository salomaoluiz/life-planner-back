import { Inject, Injectable } from '@nestjs/common';

import {
  MarketIndexHistoryInput,
  MarketIndexHistorySchema,
} from '@investment/application/dto/MarketIndex';
import {
  toChanges,
  toFollowers,
  toIpcaPoints,
  toStepPoints,
} from '@investment/application/service/MarketIndexView';
import { MarketIndex, MarketIndexSeries } from '@investment/domain/enum';
import { IMarketIndexRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface MarketIndexHistoryView {
  changes: { delta: null | string; since: string; value: string }[];
  followers: ReturnType<typeof toFollowers>;
  index: MarketIndex;
  points: (
    | { accumulated12m: null | string; month: string; monthly: string }
    | { date: string; value: string }
  )[];
}

// Spec 113 FR 19: step points (one per change) for the CDI and the Selic, one point per month for the IPCA.
@Injectable()
export class GetMarketIndexHistoryUseCase implements UseCaseWithParams<
  MarketIndexHistoryInput,
  MarketIndexHistoryView
> {
  constructor(
    @Inject('IMarketIndexRepository')
    private readonly indexes: IMarketIndexRepository,
  ) {}

  async execute(params: MarketIndexHistoryInput): Promise<MarketIndexHistoryView> {
    const input = validate(MarketIndexHistorySchema, params);
    const followers = toFollowers(
      input.index,
      await this.indexes.findFollowers(input.accessibleOwners, input.today),
    );

    if (input.index === MarketIndex.IPCA) {
      const [monthly, accumulated] = await Promise.all([
        this.indexes.findHistory(MarketIndexSeries.IPCA_MONTHLY, input.from, input.to),
        this.indexes.findHistory(MarketIndexSeries.IPCA_12M, input.from, input.to),
      ]);

      return {
        changes: [],
        followers,
        index: input.index,
        points: toIpcaPoints(monthly, accumulated),
      };
    }

    const series =
      input.index === MarketIndex.CDI
        ? MarketIndexSeries.CDI_ANNUAL
        : MarketIndexSeries.SELIC_TARGET;
    const steps = toStepPoints(await this.indexes.findHistory(series, input.from, input.to));

    return { changes: toChanges(steps), followers, index: input.index, points: steps };
  }
}
