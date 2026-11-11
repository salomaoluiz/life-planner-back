import { Inject, Injectable } from '@nestjs/common';

import { CorporateEventMapper } from '@investment/data/datasource/mapper/CorporateEventMapper';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { ICorporateEventDatasource } from '@investment/data/repository/datasource/ICorporateEventDatasource';
import {
  CorporateEventEntity,
  CorporateEventUpsert,
  EventSuggestionEntity,
  EventSuggestionInputs,
  NewEventSuggestionRow,
} from '@investment/domain/entity/CorporateEventEntity';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { ICorporateEventRepository } from '@investment/domain/repository';

@Injectable()
export class CorporateEventRepository implements ICorporateEventRepository {
  constructor(
    @Inject('ICorporateEventDatasource') private readonly datasource: ICorporateEventDatasource,
  ) {}

  async countPendingByAsset(assetIds: string[]): Promise<Map<string, number>> {
    const rows = await this.datasource.countPendingByAsset(assetIds);

    return new Map(rows.map((row) => [row.asset_id, row.count]));
  }

  async createSuggestions(rows: NewEventSuggestionRow[]): Promise<number> {
    return this.datasource.createSuggestions(
      rows.map((row) => ({
        asset_id: row.assetId,
        event_id: row.eventId,
        quantity: row.quantity,
      })),
    );
  }

  async findEvents(
    keys: { market: QuoteMarket; ticker: string }[],
    sinceRecordDate: string,
  ): Promise<CorporateEventEntity[]> {
    const rows = await this.datasource.findEvents(
      keys,
      InvestmentMapper.fromCalendarDate(sinceRecordDate),
    );

    return rows.map((row) => CorporateEventMapper.toEvent(row));
  }

  async findPendingSuggestions(
    assetIds: string[],
    limit: number,
    cursor?: string,
  ): Promise<EventSuggestionEntity[]> {
    const rows = await this.datasource.findPendingSuggestions(assetIds, limit, cursor);

    return rows.map((row) => CorporateEventMapper.toSuggestion(row));
  }

  async findSuggestionById(id: string): Promise<EventSuggestionEntity | null> {
    const row = await this.datasource.findSuggestionById(id);

    return row ? CorporateEventMapper.toSuggestion(row) : null;
  }

  async findSuggestionInputs(
    keys: { market: QuoteMarket; ticker: string }[],
  ): Promise<EventSuggestionInputs> {
    const row = await this.datasource.findSuggestionInputs(keys);

    return {
      assets: row.assets.map((asset) => ({
        assetClass: InvestmentAssetClass[asset.asset_class],
        assetId: asset.asset_id,
        market: QuoteMarket[asset.market as keyof typeof QuoteMarket],
        operations: asset.operations.map((operation) =>
          InvestmentMapper.toPositionOperation(operation),
        ),
        ticker: asset.ticker,
      })),
      existing: row.existing.map((item) => `${item.asset_id}:${item.event_id}`),
    };
  }

  async rejectSuggestion(id: string, userId: string): Promise<void> {
    await this.datasource.rejectSuggestion(id, userId);
  }

  async runExclusive(key: number, fn: () => Promise<void>): Promise<boolean> {
    return this.datasource.runExclusive(key, fn);
  }

  async upsertEvents(rows: CorporateEventUpsert[]): Promise<number> {
    return this.datasource.upsertEvents(rows);
  }
}
