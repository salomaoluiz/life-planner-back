import { Inject, Injectable } from '@nestjs/common';

import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { toOwnerWhere } from '@investment/data/datasource/mapper/OwnerWhere';
import { IMarketIndexDatasource } from '@investment/data/repository/datasource/IMarketIndexDatasource';
import {
  MarketIndexFetchEntity,
  MarketIndexFollower,
  MarketIndexFxPair,
  MarketIndexPoint,
  MarketIndexWrite,
} from '@investment/domain/entity/MarketIndexEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentFixedIncomeRateMode, MarketIndexSeries } from '@investment/domain/enum';
import { IMarketIndexRepository } from '@investment/domain/repository';
import { IndexSeriesData } from '@investment/domain/service/IndexSeries';

const FOLLOWED = [
  MarketIndexSeries.CDI_DAILY,
  MarketIndexSeries.IPCA_EXPECTED_12M,
  MarketIndexSeries.IPCA_MONTHLY,
];
const SEED_DAYS = 10;
const DAY_MS = 86_400_000;

@Injectable()
export class MarketIndexRepository implements IMarketIndexRepository {
  constructor(
    @Inject('IMarketIndexDatasource')
    private readonly datasource: IMarketIndexDatasource,
  ) {}

  async findFetches(): Promise<MarketIndexFetchEntity[]> {
    const rows = await this.datasource.findFetches();

    return rows.map((row) => ({
      lastAttemptAt: row.last_attempt_at,
      lastError: row.last_error,
      lastSuccessAt: row.last_success_at,
      series: row.series as MarketIndexSeries,
    }));
  }

  // The latest rate entry that has started (else the first) decides what a title follows.
  async findFollowers(owners: OwnerAccess[], today: string): Promise<MarketIndexFollower[]> {
    if (owners.length === 0) {
      return [];
    }

    const assets = await this.datasource.findFollowers(toOwnerWhere(owners).OR);

    return assets.flatMap((asset) => {
      const started = asset.fixed_income_rates.filter(
        (rate) => InvestmentMapper.toCalendarDate(rate.start_date) <= today,
      );
      const rate = started[started.length - 1] ?? asset.fixed_income_rates[0];

      return rate
        ? [
            {
              assetId: asset.id,
              cdiPercent: rate.cdi_percent ? rate.cdi_percent.toString() : null,
              mode: rate.mode as InvestmentFixedIncomeRateMode,
              name: asset.name,
              spread: rate.spread ? rate.spread.toString() : null,
            },
          ]
        : [];
    });
  }

  async findFxPairs(): Promise<MarketIndexFxPair[]> {
    const rows = await this.datasource.findFxPairs();

    return rows.map((row) => ({
      pair: row.pair,
      quotedAt: row.quoted_at,
      rate: row.rate.toFixed(6),
    }));
  }

  async findHistory(
    series: MarketIndexSeries,
    from: string,
    to: string,
  ): Promise<MarketIndexPoint[]> {
    const rows = await this.datasource.findValues(
      [series],
      InvestmentMapper.fromCalendarDate(from),
      InvestmentMapper.fromCalendarDate(to),
    );

    return rows.map(toPoint);
  }

  async findLatest(): Promise<Map<MarketIndexSeries, MarketIndexPoint>> {
    const rows = await this.datasource.findLatest();

    return new Map(rows.map((row) => [row.series as MarketIndexSeries, toPoint(row)]));
  }

  async findLatestDates(): Promise<Map<MarketIndexSeries, string>> {
    const rows = await this.datasource.findLatestDates();

    return new Map(
      rows.map((row) => [
        row.series as MarketIndexSeries,
        InvestmentMapper.toCalendarDate(row.date),
      ]),
    );
  }

  // One read from a few days (and the month) before `from`, so the value of a day before the first row still carries
  // forward; a second one only when no Focus expectation fell inside the window.
  async findSeriesData(from: string): Promise<IndexSeriesData> {
    const start = new Date(
      Math.min(
        InvestmentMapper.fromCalendarDate(from).getTime() - SEED_DAYS * DAY_MS,
        InvestmentMapper.fromCalendarDate(`${from.slice(0, 7)}-01`).getTime(),
      ),
    );
    const rows = await this.datasource.findValues(FOLLOWED, start);
    function only(series: MarketIndexSeries): { date: string; value: number }[] {
      return rows
        .filter((row) => row.series === series)
        .map((row) => ({
          date: InvestmentMapper.toCalendarDate(row.date),
          value: Number(row.value.toString()),
        }));
    }
    let ipcaExpected = only(MarketIndexSeries.IPCA_EXPECTED_12M);

    if (ipcaExpected.length === 0) {
      const latest = await this.datasource.findLatestBefore(
        MarketIndexSeries.IPCA_EXPECTED_12M,
        new Date(Date.now() + DAY_MS),
      );

      ipcaExpected = latest
        ? [
            {
              date: InvestmentMapper.toCalendarDate(latest.date),
              value: Number(latest.value.toString()),
            },
          ]
        : [];
    }

    return {
      cdiDaily: only(MarketIndexSeries.CDI_DAILY),
      ipcaExpected,
      ipcaMonthly: only(MarketIndexSeries.IPCA_MONTHLY),
    };
  }

  async recordFetch(
    series: MarketIndexSeries,
    outcome: { at: Date; error: null | string },
  ): Promise<void> {
    await this.datasource.recordFetch(series, outcome);
  }

  async upsertValues(
    series: MarketIndexSeries,
    rows: MarketIndexWrite[],
    fetchedAt: Date,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.datasource.upsertValues(
      series,
      rows.map((row) => ({ ...row, date: InvestmentMapper.fromCalendarDate(row.date) })),
      fetchedAt,
    );
  }

  async versionStamp(): Promise<string> {
    return (await this.datasource.versionStamp())?.toISOString() ?? 'none';
  }
}

function toPoint(row: { date: Date; value: { toString(): string } }): MarketIndexPoint {
  return { date: InvestmentMapper.toCalendarDate(row.date), value: row.value.toString() };
}
