import { QuoteEntity } from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { marketDateOf } from '@investment/domain/service/MarketDate';
import { Decimal8 } from '@shared/infra/decimal';

export type PriceSource = 'MANUAL' | 'QUOTE';
export interface ResolvedPrice {
  date: string;
  source: PriceSource;
  unitPrice: Decimal8;
}

// Spec 104 FR 20: the latest automatic quote, unless a manual valuation is dated on or after the quote's market
// date (same date: manual wins). Without a quote the manual valuation is the price.
export function resolvePrice(input: {
  quote: null | QuoteEntity;
  valuation: { date: string; unitPrice: Decimal8 } | null;
}): null | ResolvedPrice {
  const { quote, valuation } = input;
  const quoteDate = quote ? marketDateOf(quote.quotedAt, quote.market) : null;

  if (valuation && (quoteDate === null || valuation.date >= quoteDate)) {
    return { date: valuation.date, source: 'MANUAL', unitPrice: valuation.unitPrice };
  }
  if (quote && quoteDate) {
    return { date: quoteDate, source: 'QUOTE', unitPrice: quote.price };
  }

  return null;
}

// Spec 104 FR 21: older than the last business day of its market, or the last fetch failed after the last success.
export function isStale(quote: QuoteEntity, lastBusinessDay: string): boolean {
  return (
    marketDateOf(quote.quotedAt, quote.market) < lastBusinessDay ||
    (quote.lastErrorAt !== null && quote.lastErrorAt > quote.fetchedAt)
  );
}

// Classes that have an automatic quote (spec 104 FR 1).
export function marketOfClass(assetClass: string): null | QuoteMarket {
  if (assetClass === 'BR_STOCK' || assetClass === 'BR_REIT') {
    return QuoteMarket.B3;
  }

  return assetClass === 'FOREIGN_STOCK' ? QuoteMarket.US : null;
}
