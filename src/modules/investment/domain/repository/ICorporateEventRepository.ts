import {
  CorporateEventEntity,
  CorporateEventUpsert,
  EventSuggestionEntity,
  EventSuggestionInputs,
  NewEventSuggestionRow,
} from '@investment/domain/entity/CorporateEventEntity';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

// Spec 108: announced events (market data) and the per-asset suggestions built from them.
export interface ICorporateEventRepository {
  // Pending suggestions per asset (for the asset list counts).
  countPendingByAsset(assetIds: string[]): Promise<Map<string, number>>;
  createSuggestions(rows: NewEventSuggestionRow[]): Promise<number>;
  findEvents(
    keys: { market: QuoteMarket; ticker: string }[],
    sinceRecordDate: string,
  ): Promise<CorporateEventEntity[]>;
  // Pending only, newest data-com first; `limit + 1` rows tell the caller there is a next page.
  findPendingSuggestions(
    assetIds: string[],
    limit: number,
    cursor?: string,
  ): Promise<EventSuggestionEntity[]>;
  findSuggestionById(id: string): Promise<EventSuggestionEntity | null>;
  findSuggestionInputs(
    keys: { market: QuoteMarket; ticker: string }[],
  ): Promise<EventSuggestionInputs>;
  rejectSuggestion(id: string, userId: string): Promise<void>;
  runExclusive(key: number, fn: () => Promise<void>): Promise<boolean>;
  upsertEvents(rows: CorporateEventUpsert[]): Promise<number>;
}
