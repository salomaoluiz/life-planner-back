import { InvestmentIncomeType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { addDays } from '@investment/domain/service/MarketDate';
import { Decimal8 } from '@shared/infra/decimal';

const LOOKBACK_MONTHS = 12;
const PAYMENT_WINDOW_DAYS = 3;

export interface MatcherAsset {
  firstBuyDate: null | string;
  id: string;
  market: QuoteMarket;
  // Position at the end of `date` (operations dated on or before it), spec 102 `PositionCalculator`.
  positionAt: (date: string) => Decimal8;
  ticker: string;
}
export interface MatcherEvent {
  exDate: string;
  id: string;
  market: QuoteMarket;
  paymentDate: null | string;
  ticker: string;
  type: InvestmentIncomeType;
}
export interface MatcherIncome {
  assetId: string;
  exDate: null | string;
  paymentDate: string;
  type: InvestmentIncomeType;
}
export interface MatcherInput {
  assets: MatcherAsset[];
  events: MatcherEvent[];
  incomes: MatcherIncome[];
  // `${assetId}:${eventId}` of every suggestion in any state.
  existing: Set<string>;
  today: string;
}
export interface NewSuggestion {
  assetId: string;
  eventId: string;
  quantity: Decimal8;
}

export function suggestionKey(assetId: string, eventId: string): string {
  return `${assetId}:${eventId}`;
}

// Spec 107 FR 26: events that become a suggestion of an asset.
export function matchSuggestions(input: MatcherInput): NewSuggestion[] {
  const cutoff = monthsAgo(input.today, LOOKBACK_MONTHS);
  const result: NewSuggestion[] = [];

  for (const asset of input.assets) {
    if (!asset.firstBuyDate) {
      continue;
    }

    for (const event of input.events) {
      if (event.market !== asset.market || event.ticker !== asset.ticker) {
        continue;
      }
      if (event.exDate < asset.firstBuyDate || event.exDate < cutoff) {
        continue;
      }
      if (input.existing.has(suggestionKey(asset.id, event.id))) {
        continue;
      }
      if (alreadyEntered(input.incomes, asset.id, event)) {
        continue;
      }

      const quantity = asset.positionAt(event.exDate);

      if (quantity.isPositive()) {
        result.push({ assetId: asset.id, eventId: event.id, quantity });
      }
    }
  }

  return result;
}

function alreadyEntered(incomes: MatcherIncome[], assetId: string, event: MatcherEvent): boolean {
  return incomes.some((income) => {
    if (income.assetId !== assetId || income.type !== event.type) {
      return false;
    }
    if (income.exDate) {
      return income.exDate === event.exDate;
    }

    return (
      event.paymentDate !== null &&
      income.paymentDate >= addDays(event.paymentDate, -PAYMENT_WINDOW_DAYS) &&
      income.paymentDate <= addDays(event.paymentDate, PAYMENT_WINDOW_DAYS)
    );
  });
}
function monthsAgo(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);

  value.setUTCMonth(value.getUTCMonth() - months);

  return value.toISOString().slice(0, 10);
}
