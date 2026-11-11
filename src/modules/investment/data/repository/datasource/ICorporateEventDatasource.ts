import { InvestmentCorporateEvent, InvestmentEventSuggestion } from '@db/client';
import { PositionColumns } from '@investment/data/datasource/mapper/InvestmentMapper';
import { CorporateEventUpsert } from '@investment/domain/entity/CorporateEventEntity';

export interface EventSuggestionInputsRow {
  assets: {
    asset_class: 'BR_REIT' | 'BR_STOCK' | 'FIXED_INCOME' | 'FOREIGN_STOCK' | 'PRIVATE';
    asset_id: string;
    market: string;
    operations: PositionColumns[];
    ticker: string;
  }[];
  existing: { asset_id: string; event_id: string }[];
}
export type EventSuggestionRow = { event: InvestmentCorporateEvent } & InvestmentEventSuggestion;
export interface ICorporateEventDatasource {
  countPendingByAsset(assetIds: string[]): Promise<{ asset_id: string; count: number }[]>;
  createSuggestions(
    rows: { asset_id: string; event_id: string; quantity: string }[],
  ): Promise<number>;
  findEvents(
    keys: { market: string; ticker: string }[],
    sinceRecordDate: Date,
  ): Promise<InvestmentCorporateEvent[]>;
  findPendingSuggestions(
    assetIds: string[],
    limit: number,
    cursor?: string,
  ): Promise<EventSuggestionRow[]>;
  findSuggestionById(id: string): Promise<EventSuggestionRow | null>;
  findSuggestionInputs(
    keys: { market: string; ticker: string }[],
  ): Promise<EventSuggestionInputsRow>;
  rejectSuggestion(id: string, userId: string): Promise<void>;
  runExclusive(key: number, fn: () => Promise<void>): Promise<boolean>;
  upsertEvents(rows: CorporateEventUpsert[]): Promise<number>;
}
