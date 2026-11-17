import {
  MarketIndexFetchEntity,
  MarketIndexFollower,
  MarketIndexFxPair,
  MarketIndexPoint,
  MarketIndexWrite,
} from '@investment/domain/entity/MarketIndexEntity';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { MarketIndexSeries } from '@investment/domain/enum';
import { IndexSeriesData } from '@investment/domain/service/IndexSeries';

export type IMarketIndexRepository = {
  // Latest stored row per series.
  findLatest(): Promise<Map<MarketIndexSeries, MarketIndexPoint>>;
  // Latest stored date per series, to fetch only what is new.
  findFetches(): Promise<MarketIndexFetchEntity[]>;
  findFollowers(owners: OwnerAccess[], today: string): Promise<MarketIndexFollower[]>;
  findFxPairs(): Promise<MarketIndexFxPair[]>;
  findHistory(series: MarketIndexSeries, from: string, to: string): Promise<MarketIndexPoint[]>;
  findLatestDates(): Promise<Map<MarketIndexSeries, string>>;
  // The series calculated titles follow from `from` on, in at most 2 queries (spec 113 FR 13).
  findSeriesData(from: string): Promise<IndexSeriesData>;
  // Recalculates, each in its own transaction, the titles whose rate follows an index (FR 16); returns how many.
  recalculateIndexedTitles(): Promise<number>;
  recordFetch(
    series: MarketIndexSeries,
    outcome: { at: Date; error: null | string },
  ): Promise<void>;
  upsertValues(series: MarketIndexSeries, rows: MarketIndexWrite[], fetchedAt: Date): Promise<void>;
  // Latest `fetched_at` of any series, the data version of the ETag.
  versionStamp(): Promise<string>;
};
