import { Inject } from '@nestjs/common';

import {
  GetIncomeSeriesProjectionsInput,
  GetIncomeSeriesProjectionsSchema,
} from '@investment/application/dto/IncomeSeries';
import { positionAt } from '@investment/application/service/IncomeRules';
import { draftOf, ruleOf } from '@investment/application/service/IncomeSeriesRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { narrowOwners } from '@investment/domain/entity/OwnerAccess';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { IIncomeSeriesRepository, IInvestmentRepository } from '@investment/domain/repository';
import {
  addDays,
  lastDayOfMonth,
  occurrencesBetween,
} from '@investment/domain/service/IncomeSeriesSchedule';
import { suggestNet, withholdingBps } from '@investment/domain/service/IncomeWithholding';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

export interface ProjectedIncome {
  accountId: null | string;
  assetId: string;
  assetLabel: string;
  categoryId: null | string;
  currency: string;
  exDate: string;
  netAmount: number;
  number: number;
  paymentDate: string;
  quantity: string;
  seriesId: string;
  type: InvestmentIncomeType;
  withFinance: boolean;
}

// Spec 053 rule: projections reach at most 24 months after the current month.
const MAX_MONTHS_AHEAD = 24;

// Spec 115 FR 21: the occurrences after the current month, with the CURRENT position (future operations are unknown).
export class GetIncomeSeriesProjectionsUseCase implements UseCaseWithParams<
  GetIncomeSeriesProjectionsInput,
  ProjectedIncome[]
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
  ) {}

  async execute(params: GetIncomeSeriesProjectionsInput): Promise<ProjectedIncome[]> {
    const input = validate(GetIncomeSeriesProjectionsSchema, params);
    const today = input.today ?? todayInSaoPaulo();
    const horizon = lastDayOfMonth(today);
    const from = input.from > horizon ? input.from : addDays(horizon, 1);
    const limit = addDays(horizon, MAX_MONTHS_AHEAD * 31);
    const to = input.to < limit ? input.to : limit;
    const owners = narrowOwners(
      input.accessibleOwners,
      input.ownerIds?.length === 1 ? input.ownerIds[0] : undefined,
    ).filter((access) => !access.archived);

    if (owners.length === 0 || from > to) {
      return [];
    }

    const series = await this.seriesRepository.findActiveByOwners(owners);
    const assets = new Map<string, AssetDetail | undefined>();
    const items: ProjectedIncome[] = [];

    for (const entry of series) {
      if (!assets.has(entry.assetId)) {
        assets.set(entry.assetId, await this.investment.findAssetById(entry.assetId));
      }

      const asset = assets.get(entry.assetId);

      if (!asset) {
        continue;
      }

      const quantity = positionAt(asset.operations, asset.assetClass);

      if (quantity.isZero()) {
        continue;
      }

      const rate = withholdingBps(entry.type, asset.assetClass);
      const net = suggestNet(quantity, Decimal8.parse(entry.amountPerUnit), rate);

      for (const occurrence of occurrencesBetween(ruleOf(draftOf(entry)), from, to)) {
        if (occurrence.number <= entry.lastGeneratedNumber) {
          continue;
        }

        items.push({
          accountId: entry.accountId,
          assetId: asset.id,
          assetLabel: asset.ticker ?? asset.name,
          categoryId: entry.categoryId,
          currency: entry.currency,
          exDate: occurrence.exDate,
          netAmount: net,
          number: occurrence.number,
          paymentDate: occurrence.paymentDate,
          quantity: quantity.toString(),
          seriesId: entry.id,
          type: entry.type,
          withFinance: entry.withFinance,
        });
      }
    }

    return items.sort(
      (a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.seriesId.localeCompare(b.seriesId),
    );
  }
}
