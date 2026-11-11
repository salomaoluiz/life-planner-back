import { IncomeSuggestionAsset } from '@investment/domain/entity/IncomeEntity';
import { InvestmentCorporateEventType, InvestmentSuggestionStatus } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

// Spec 108: announced corporate events are market data (no owner); ratios and percent are decimal strings.
export interface CorporateEventEntity {
  bonusPercent: null | string;
  bonusUnitCost: null | string;
  currency: string;
  id: string;
  market: QuoteMarket;
  ratioFrom: null | string;
  ratioTo: null | string;
  // The data-com (last day with rights), `YYYY-MM-DD`.
  recordDate: string;
  ticker: string;
  type: InvestmentCorporateEventType;
}
export interface CorporateEventUpsert {
  bonusPercent: null | string;
  bonusUnitCost: null | string;
  currency: string;
  eventKey: string;
  fetchedAt: Date;
  market: QuoteMarket;
  ratioFrom: null | string;
  ratioTo: null | string;
  recordDate: string;
  source: string;
  ticker: string;
  type: InvestmentCorporateEventType;
}
export interface EventSuggestionEntity {
  assetId: string;
  event: CorporateEventEntity;
  eventId: string;
  id: string;
  // Position at the end of the data-com.
  quantity: string;
  status: InvestmentSuggestionStatus;
}
export interface EventSuggestionInputs {
  assets: IncomeSuggestionAsset[];
  // `${assetId}:${eventId}` of every event suggestion in any state.
  existing: string[];
}
export interface NewEventSuggestionRow {
  assetId: string;
  eventId: string;
  quantity: string;
}
