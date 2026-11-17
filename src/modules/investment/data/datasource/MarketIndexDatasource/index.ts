import { Injectable } from '@nestjs/common';

import {
  FxRate,
  InvestmentAsset,
  InvestmentFixedIncomeRate,
  MarketIndexFetch,
  MarketIndexSeries,
  MarketIndexValue,
  Prisma,
} from '@db/client';
import { recalculateFixedIncome } from '@investment/data/datasource/fixedIncome';
import { IMarketIndexDatasource } from '@investment/data/repository/datasource/IMarketIndexDatasource';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';
import { Database } from '@shared/infra/db/Database';

const CHUNK = 1000;

@Injectable()
export class MarketIndexDatasource implements IMarketIndexDatasource {
  constructor(private readonly db: Database) {}

  async findFetches(): Promise<MarketIndexFetch[]> {
    return this.db.client.marketIndexFetch.findMany();
  }

  async findFollowers(
    where: { owner: string; owner_id: string }[],
  ): Promise<({ fixed_income_rates: InvestmentFixedIncomeRate[] } & InvestmentAsset)[]> {
    return this.db.client.investmentAsset.findMany({
      include: { fixed_income_rates: { orderBy: { start_date: 'asc' } } },
      orderBy: { name: 'asc' },
      where: {
        fixed_income_terms: { isNot: null },
        OR: where as Prisma.InvestmentAssetWhereInput[],
        status: InvestmentAssetStatus.ACTIVE,
      },
    });
  }

  async findFxPairs(): Promise<FxRate[]> {
    return this.db.client.fxRate.findMany({ orderBy: { pair: 'asc' } });
  }

  // One row per series: the latest by date.
  async findIndexedAssetIds(): Promise<string[]> {
    const rows = await this.db.client.investmentFixedIncomeRate.findMany({
      distinct: ['asset_id'],
      select: { asset_id: true },
      where: { mode: { in: ['CDI_PERCENT', 'IPCA_PLUS'] } },
    });

    return rows.map((row) => row.asset_id);
  }

  async findLatest(): Promise<MarketIndexValue[]> {
    return this.db.client.marketIndexValue.findMany({
      distinct: ['series'],
      orderBy: [{ series: 'asc' }, { date: 'desc' }],
    });
  }

  async findLatestBefore(series: string, before: Date): Promise<MarketIndexValue | null> {
    return this.db.client.marketIndexValue.findFirst({
      orderBy: { date: 'desc' },
      where: { date: { lt: before }, series: series as MarketIndexSeries },
    });
  }

  async findLatestDates(): Promise<{ date: Date; series: string }[]> {
    const rows = await this.db.client.marketIndexValue.groupBy({
      _max: { date: true },
      by: ['series'],
    });

    return rows.flatMap((row) =>
      row._max.date ? [{ date: row._max.date, series: row.series }] : [],
    );
  }

  async findValues(series: string[], from: Date, to?: Date): Promise<MarketIndexValue[]> {
    return this.db.client.marketIndexValue.findMany({
      orderBy: [{ series: 'asc' }, { date: 'asc' }],
      where: {
        date: to ? { gte: from, lte: to } : { gte: from },
        series: { in: series as MarketIndexSeries[] },
      },
    });
  }

  async recalculateAsset(assetId: string): Promise<boolean> {
    try {
      await this.db.client.$transaction(async (tx) => {
        await recalculateFixedIncome(tx, assetId);
      });

      return true;
    } catch (error) {
      if (error instanceof FixedIncomeRedemptionTooLargeError) {
        return false;
      }

      throw error;
    }
  }

  async recordFetch(series: string, outcome: { at: Date; error: null | string }): Promise<void> {
    const key = series as MarketIndexSeries;
    const success = outcome.error === null;

    await this.db.client.marketIndexFetch.upsert({
      create: {
        last_attempt_at: outcome.at,
        last_error: outcome.error,
        last_success_at: success ? outcome.at : null,
        series: key,
      },
      update: {
        last_attempt_at: outcome.at,
        last_error: outcome.error,
        ...(success ? { last_success_at: outcome.at } : {}),
      },
      where: { series: key },
    });
  }

  async upsertValues(
    series: string,
    rows: { date: Date; source: string; value: string }[],
    fetchedAt: Date,
  ): Promise<void> {
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk = rows.slice(start, start + CHUNK);
      const values = Prisma.join(
        chunk.map(
          (row) =>
            Prisma.sql`(gen_random_uuid()::text, ${series}::"MarketIndexSeries", ${row.date}::date, ${row.value}::numeric, ${row.source}, ${fetchedAt})`,
        ),
      );

      await this.db.client.$executeRaw(Prisma.sql`
        INSERT INTO market_index_values (id, series, date, value, source, fetched_at)
        VALUES ${values}
        ON CONFLICT (series, date) DO UPDATE
        SET value = EXCLUDED.value, source = EXCLUDED.source, fetched_at = EXCLUDED.fetched_at
      `);
    }
  }

  async versionStamp(): Promise<Date | null> {
    const row = await this.db.client.marketIndexValue.aggregate({ _max: { fetched_at: true } });

    return row._max.fetched_at;
  }
}
