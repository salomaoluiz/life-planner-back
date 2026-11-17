import {
  FxRate,
  InvestmentAsset,
  InvestmentFixedIncomeRate,
  MarketIndexFetch,
  MarketIndexValue,
} from '@db/client';

export type IMarketIndexDatasource = {
  // Rows of the series dated on or after `from`, ascending by series then date.
  findFetches(): Promise<MarketIndexFetch[]>;
  findFollowers(
    where: { owner: string; owner_id: string }[],
  ): Promise<({ fixed_income_rates: InvestmentFixedIncomeRate[] } & InvestmentAsset)[]>;
  findFxPairs(): Promise<FxRate[]>;
  findLatest(): Promise<MarketIndexValue[]>;
  findLatestBefore(series: string, before: Date): Promise<MarketIndexValue | null>;
  findLatestDates(): Promise<{ date: Date; series: string }[]>;
  findValues(series: string[], from: Date, to?: Date): Promise<MarketIndexValue[]>;
  // Asset ids whose rate entries are CDI_PERCENT or IPCA_PLUS.
  findIndexedAssetIds(): Promise<string[]>;
  // One recalculation (spec 105 FR 21) in its own transaction; false when a redemption no longer fits.
  recalculateAsset(assetId: string): Promise<boolean>;
  recordFetch(series: string, outcome: { at: Date; error: null | string }): Promise<void>;
  upsertValues(
    series: string,
    rows: { date: Date; source: string; value: string }[],
    fetchedAt: Date,
  ): Promise<void>;
  versionStamp(): Promise<Date | null>;
};
