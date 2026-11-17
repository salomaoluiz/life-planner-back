import { Inject, Injectable } from '@nestjs/common';

import { IncomeSeriesDatasource } from '@investment/data/datasource/IncomeSeriesDatasource';
import { IncomeSeriesMapper } from '@investment/data/datasource/mapper/IncomeSeriesMapper';
import {
  CreateSeriesParams,
  IncomeSeriesEntity,
  OccurrenceInsert,
  PlannedRewrite,
  SeriesPatch,
} from '@investment/domain/entity/IncomeSeriesEntity';
import { IncomeSeriesEndReason } from '@investment/domain/enum';
import {
  IIncomeSeriesRepository,
  PlannedOccurrence,
  SeriesOccurrenceCounts,
} from '@investment/domain/repository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

@Injectable()
export class IncomeSeriesRepository implements IIncomeSeriesRepository {
  constructor(
    @Inject('IIncomeSeriesDatasource') private readonly datasource: IncomeSeriesDatasource,
  ) {}

  async countOccurrences(seriesId: string): Promise<SeriesOccurrenceCounts> {
    return this.datasource.countOccurrences(seriesId);
  }

  async createSeries(params: CreateSeriesParams): Promise<string> {
    return this.datasource.createSeries(params);
  }

  async deleteSeries(id: string): Promise<void> {
    await this.datasource.deleteSeries(id);
  }

  async endSeries(params: {
    deleteFromNumber?: number;
    endedAt: string;
    endReason: IncomeSeriesEndReason;
    id: string;
  }): Promise<void> {
    await this.datasource.endSeries(params);
  }

  async findActiveByOwners(
    owners: { owner: OwnerType; ownerId: string }[],
  ): Promise<IncomeSeriesEntity[]> {
    return (await this.datasource.findActiveByOwners(owners)).map((row) =>
      IncomeSeriesMapper.toSeries(row),
    );
  }

  async findAllActive(): Promise<IncomeSeriesEntity[]> {
    return (await this.datasource.findAllActive()).map((row) => IncomeSeriesMapper.toSeries(row));
  }

  async findByAsset(assetId: string): Promise<IncomeSeriesEntity[]> {
    return (await this.datasource.findByAsset(assetId)).map((row) =>
      IncomeSeriesMapper.toSeries(row),
    );
  }

  async findById(id: string): Promise<IncomeSeriesEntity | undefined> {
    const row = await this.datasource.findById(id);

    return row ? IncomeSeriesMapper.toSeries(row) : undefined;
  }

  async findPlannedFrom(seriesId: string, fromNumber: number): Promise<PlannedOccurrence[]> {
    return this.datasource.findPlannedFrom(seriesId, fromNumber);
  }

  async materialize(params: {
    assetLabel: string;
    ended?: { endedAt: string; endReason: IncomeSeriesEndReason };
    lastGeneratedNumber: number;
    occurrences: OccurrenceInsert[];
    seriesId: string;
  }): Promise<void> {
    await this.datasource.materialize(params);
  }

  async splitSeries(params: {
    create: CreateSeriesParams;
    deleteFromNumber: number;
    endedAt: string;
    id: string;
  }): Promise<string> {
    return this.datasource.splitSeries(params);
  }

  async updateSeries(params: {
    assetLabel: string;
    patch: SeriesPatch;
    planned?: PlannedRewrite[];
    seriesId: string;
  }): Promise<void> {
    await this.datasource.updateSeries(params);
  }
}
