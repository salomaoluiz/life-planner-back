import {
  draftOf,
  nextPaymentDateOf,
  planSeries,
} from '@investment/application/service/IncomeSeriesRules';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { IncomeSeriesEntity } from '@investment/domain/entity/IncomeSeriesEntity';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import { IIncomeSeriesRepository, IInvestmentRepository } from '@investment/domain/repository';
import { lastDayOfMonth } from '@investment/domain/service/IncomeSeriesSchedule';

// Spec 115 FR 18-19: for every series whose next occurrence falls up to the end of `today`'s month, creates the missing
// planned occurrences (quantity and net amount of that moment). Shared by the read path and the monthly job.
export async function materializeDueSeries(
  investment: IInvestmentRepository,
  seriesRepository: IIncomeSeriesRepository,
  series: IncomeSeriesEntity[],
  today: string,
): Promise<void> {
  const horizon = lastDayOfMonth(today);
  const assets = new Map<string, AssetDetail | undefined>();

  for (const entry of series) {
    const next = nextPaymentDateOf(entry);

    if (next === null || next > horizon) {
      continue;
    }
    if (!assets.has(entry.assetId)) {
      assets.set(entry.assetId, await investment.findAssetById(entry.assetId));
    }

    const asset = assets.get(entry.assetId);

    if (!asset || asset.status === InvestmentAssetStatus.ARCHIVED) {
      continue;
    }

    const plan = planSeries({
      afterNumber: entry.lastGeneratedNumber,
      asset,
      draft: draftOf(entry),
      markPast: false,
      today,
    });

    if (plan.insert.length === 0 && !plan.ended) {
      continue;
    }

    await seriesRepository.materialize({
      assetLabel: asset.ticker ?? asset.name,
      ended: plan.ended,
      lastGeneratedNumber: plan.lastNumber,
      occurrences: plan.insert,
      seriesId: entry.id,
    });
  }
}
