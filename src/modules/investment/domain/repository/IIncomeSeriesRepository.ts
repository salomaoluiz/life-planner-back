import {
  CreateSeriesParams,
  IncomeSeriesEntity,
  OccurrenceInsert,
  PlannedRewrite,
  SeriesPatch,
} from '@investment/domain/entity/IncomeSeriesEntity';
import { IncomeSeriesEndReason } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 115. Every write runs in ONE database transaction with its finance rows and the account ledger.
export type IIncomeSeriesRepository = {
  // The planned occurrences of the series from `fromNumber` on (FR 24-25), ascending.
  countOccurrences(seriesId: string): Promise<SeriesOccurrenceCounts>;
  createSeries(params: CreateSeriesParams): Promise<string>;
  findPlannedFrom(seriesId: string, fromNumber: number): Promise<PlannedOccurrence[]>;
  // FR 25 `ALL`: the series and every occurrence, received ones included, with their rows (ledger adjusted).
  deleteSeries(id: string): Promise<void>;
  // FR 25 `THIS_AND_NEXT`: ends the series and deletes its planned occurrences from `deleteFromNumber` on.
  endSeries(params: {
    deleteFromNumber?: number;
    endedAt: string;
    endReason: IncomeSeriesEndReason;
    id: string;
  }): Promise<void>;
  // FR 18: every active series (the monthly job runs without a user).
  findActiveByOwners(
    owners: { owner: OwnerType; ownerId: string }[],
  ): Promise<IncomeSeriesEntity[]>;
  findAllActive(): Promise<IncomeSeriesEntity[]>;
  findByAsset(assetId: string): Promise<IncomeSeriesEntity[]>;
  findById(id: string): Promise<IncomeSeriesEntity | undefined>;
  // FR 18: inserts planned occurrences of a series and moves its cursor (and ends it when `ended` is set).
  materialize(params: {
    assetLabel: string;
    ended?: { endedAt: string; endReason: IncomeSeriesEndReason };
    lastGeneratedNumber: number;
    occurrences: OccurrenceInsert[];
    seriesId: string;
  }): Promise<void>;
  // FR 24 `THIS_AND_NEXT`: ends the old series before `deleteFromNumber`, deletes its planned occurrences from
  // there and creates the new series with its occurrences.
  splitSeries(params: {
    create: CreateSeriesParams;
    deleteFromNumber: number;
    endedAt: string;
    id: string;
  }): Promise<string>;
  // FR 24 `ALL`, FR 26: header patch and the planned occurrences rewritten with `WriteIncomeParams`-like values.
  updateSeries(params: {
    assetLabel: string;
    patch: SeriesPatch;
    planned?: PlannedRewrite[];
    seriesId: string;
  }): Promise<void>;
};
export interface PlannedOccurrence {
  exDate: string;
  id: string;
  number: number;
  paymentDate: string;
  quantity: string;
}
export interface SeriesOccurrenceCounts {
  planned: number;
  received: number;
}
