import { InvestmentCorporateEventType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { monthsAgo, suggestionKey } from '@investment/domain/service/IncomeSuggestionMatcher';
import { addDays } from '@investment/domain/service/MarketDate';
import { Decimal8 } from '@shared/infra/decimal';

const LOOKBACK_MONTHS = 12;
const ENTERED_WINDOW_DAYS = 3;

export interface CorporateMatcherAsset {
  firstBuyDate: null | string;
  id: string;
  market: QuoteMarket;
  // Position at the end of `date`, spec 108 `PositionCalculator` with the asset's unit step.
  positionAt: (date: string) => Decimal8;
  ticker: string;
}
export interface CorporateMatcherEvent {
  id: string;
  market: QuoteMarket;
  recordDate: string;
  ticker: string;
  type: InvestmentCorporateEventType;
}
// An event operation the owner already has on the asset.
export interface EnteredEvent {
  assetId: string;
  date: string;
  type: InvestmentCorporateEventType;
}
export interface MatchEventsInput {
  assets: CorporateMatcherAsset[];
  entered: EnteredEvent[];
  events: CorporateMatcherEvent[];
  // `${assetId}:${eventId}` of every suggestion in any state.
  existing: Set<string>;
  today: string;
}
export interface NewEventSuggestion {
  assetId: string;
  eventId: string;
  quantity: Decimal8;
}

// Spec 108 FR 25: events that become a suggestion of an asset (the asset's class, status and ticker are filtered by
// the query that builds `assets`).
export function matchEventSuggestions(input: MatchEventsInput): NewEventSuggestion[] {
  const cutoff = monthsAgo(input.today, LOOKBACK_MONTHS);
  const result: NewEventSuggestion[] = [];

  for (const asset of input.assets) {
    if (!asset.firstBuyDate) {
      continue;
    }

    for (const event of input.events) {
      if (event.market !== asset.market || event.ticker !== asset.ticker) {
        continue;
      }
      // The suggestion shows from the ex-date, when the quote already reflects the event.
      if (event.recordDate >= input.today) {
        continue;
      }
      if (event.recordDate < asset.firstBuyDate || event.recordDate < cutoff) {
        continue;
      }
      if (input.existing.has(suggestionKey(asset.id, event.id))) {
        continue;
      }
      if (alreadyEntered(input.entered, asset.id, event)) {
        continue;
      }

      const quantity = asset.positionAt(event.recordDate);

      if (quantity.isPositive()) {
        result.push({ assetId: asset.id, eventId: event.id, quantity });
      }
    }
  }

  return result;
}

function alreadyEntered(
  entered: EnteredEvent[],
  assetId: string,
  event: CorporateMatcherEvent,
): boolean {
  return entered.some(
    (item) =>
      item.assetId === assetId &&
      item.type === event.type &&
      item.date >= addDays(event.recordDate, -ENTERED_WINDOW_DAYS) &&
      item.date <= addDays(event.recordDate, ENTERED_WINDOW_DAYS),
  );
}
