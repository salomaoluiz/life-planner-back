import { Inject, Injectable } from '@nestjs/common';

import { todayInSaoPaulo } from '@investment/application/service/Today';
import { MarketIndexWrite } from '@investment/domain/entity/MarketIndexEntity';
import { MarketIndexSeries } from '@investment/domain/enum';
import { IMarketIndexRepository, IQuoteRepository } from '@investment/domain/repository';
import { addDays } from '@investment/domain/service/MarketDate';
import { isInRange, isStale, sourceOf } from '@investment/domain/service/MarketIndexRules';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { IBcbIndexes, IndexPoint, MarketIndexSourceError } from '@shared/infra/market-index/types';

// One advisory lock for the whole run, so two instances never fetch at the same time (104/107 pattern).
const LOCK_KEY = 113001;
const FIRST_DAY = '2000-01-01';
const REVISION_DAYS = 10;
const OUT_OF_RANGE = 'OUT_OF_RANGE';

// Spec 113 FR 1: the SGS code of each series; the expectation comes from the Focus report.
const SOURCES: { code: null | number; series: MarketIndexSeries }[] = [
  { code: 12, series: MarketIndexSeries.CDI_DAILY },
  { code: 4389, series: MarketIndexSeries.CDI_ANNUAL },
  { code: 11, series: MarketIndexSeries.SELIC_DAILY },
  { code: 432, series: MarketIndexSeries.SELIC_TARGET },
  { code: 433, series: MarketIndexSeries.IPCA_MONTHLY },
  { code: 13522, series: MarketIndexSeries.IPCA_12M },
  { code: null, series: MarketIndexSeries.IPCA_EXPECTED_12M },
];
// The series calculated titles read: a new row there changes their numbers.
const FOLLOWED = new Set([
  MarketIndexSeries.CDI_DAILY,
  MarketIndexSeries.IPCA_EXPECTED_12M,
  MarketIndexSeries.IPCA_MONTHLY,
]);

export interface RefreshMarketIndexesParams {
  // The manual refresh asks only for the stale or missing series (FR 9).
  onlyStale?: boolean;
}
export interface RefreshMarketIndexesResult {
  skipped: boolean;
}

// Spec 113 FR 5-6: the only path that asks the Central Bank for indexes. Every series is fetched on its own: one
// failing never stops the others. Logs carry no amounts and no user data.
@Injectable()
export class RefreshMarketIndexesUseCase implements UseCaseWithParams<
  RefreshMarketIndexesParams | undefined,
  RefreshMarketIndexesResult
> {
  constructor(
    @Inject('IMarketIndexRepository') private readonly indexes: IMarketIndexRepository,
    @Inject('IQuoteRepository') private readonly quotes: IQuoteRepository,
    @Inject('IBcbIndexes') private readonly bcb: IBcbIndexes,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  async execute(params?: RefreshMarketIndexesParams): Promise<RefreshMarketIndexesResult> {
    const ran = await this.quotes.runExclusive(LOCK_KEY, async () => {
      const today = todayInSaoPaulo();
      const latest = await this.indexes.findLatestDates();
      let changed = false;

      for (const source of SOURCES) {
        const last = latest.get(source.series);

        if (params?.onlyStale && !isStale(source.series, last, today)) {
          continue;
        }

        if (await this.refreshSeries(source, last, today)) {
          changed ||= FOLLOWED.has(source.series);
        }
      }

      if (changed) {
        await this.recalculate();
      }
    });

    return { skipped: !ran };
  }

  private async fetch(
    source: { code: null | number; series: MarketIndexSeries },
    from: string,
    today: string,
  ): Promise<IndexPoint[]> {
    return source.code === null
      ? this.bcb.getIpcaExpectation(from)
      : this.bcb.getSeries(source.code, from, today);
  }

  private async recalculate(): Promise<void> {
    try {
      await this.indexes.recalculateIndexedTitles();
    } catch {
      this.logger.log(LogLevel.WARN, 'Could not recalculate the indexed titles', {
        module: 'RefreshMarketIndexesUseCase',
      });
    }
  }

  // Returns whether rows newer than the stored ones arrived.
  private async refreshSeries(
    source: { code: null | number; series: MarketIndexSeries },
    last: string | undefined,
    today: string,
  ): Promise<boolean> {
    const at = new Date();
    const from = last ? addDays(last, -REVISION_DAYS) : FIRST_DAY;

    try {
      const points = (await this.fetch(source, from, today)).filter((point) => point.date <= today);
      const rows: MarketIndexWrite[] = points
        .filter((point) => isInRange(source.series, Number(point.value)))
        .map((point) => ({
          date: point.date,
          source: sourceOf(source.series),
          value: point.value,
        }));
      const dropped = points.length - rows.length;

      await this.indexes.upsertValues(source.series, rows, at);
      await this.indexes.recordFetch(source.series, {
        at,
        error: dropped > 0 ? OUT_OF_RANGE : null,
      });

      if (dropped > 0) {
        this.logger.log(LogLevel.WARN, 'Market index values outside the limits were not stored', {
          dropped,
          module: 'RefreshMarketIndexesUseCase',
          series: source.series,
        });
      }

      return rows.some((row) => !last || row.date > last);
    } catch (error) {
      const code = error instanceof MarketIndexSourceError ? error.code : 'ERROR';

      await this.indexes.recordFetch(source.series, { at, error: code });
      this.logger.log(LogLevel.WARN, 'Market index fetch failed', {
        code,
        module: 'RefreshMarketIndexesUseCase',
        series: source.series,
      });

      return false;
    }
  }
}
