import { AssetView } from '@investment/application/service/AssetView';
import { Decimal8 } from '@shared/infra/decimal';

// One open position of the portfolio, in BRL cents.
export interface Holding {
  costCents: number;
  currentCents: number;
  manual: boolean;
  // Oldest market timestamp behind the value (quote and, for USD, the rate); null without market data.
  quotedAt: Date | null;
  stale: boolean;
  withoutPrice: boolean;
}
export interface NextMaturity {
  assetId: string;
  currency: string;
  maturityDate: string;
  name: string;
  netEstimatedCents: number;
}
export interface PortfolioTotals {
  currentValueCents: number;
  investedCents: number;
  manualCount: number;
  quotesAsOf: Date | null;
  // Result over the cost in basis points (1315 = 13.15%); null at zero cost.
  resultBasisPoints: null | number;
  resultCents: number;
  stale: boolean;
  withoutPrice: number;
}

// Spec 109 FR 16: `null` for a closed position. Calculated titles count at the estimated net, USD assets at the
// BRL numbers of the list (purchase rate for the cost, current rate for the value), an asset with no price at its cost.
export function toHolding(view: AssetView, fxRate: null | string): Holding | null {
  const { fixedIncome, market, position } = view;

  if (fixedIncome ? fixedIncome.today.gross === 0 : position.quantity.isZero()) {
    return null;
  }
  if (fixedIncome) {
    return {
      costCents: position.cost,
      currentCents: fixedIncome.today.net,
      manual: false,
      quotedAt: null,
      stale: false,
      withoutPrice: false,
    };
  }

  const quotedAt = oldest([market.quote?.quotedAt ?? null, market.fx?.quotedAt ?? null]);
  const stale = market.quote?.stale ?? false;
  const manual = market.priceSource === 'MANUAL';
  const withoutPrice = position.currentValue === null;

  if (view.asset.currency !== 'USD') {
    return {
      costCents: position.cost,
      currentCents: position.currentValue ?? position.cost,
      manual,
      quotedAt,
      stale,
      withoutPrice,
    };
  }
  if (market.usd?.result) {
    return {
      costCents: market.usd.result.costBrl,
      currentCents: market.usd.result.marketValueBrl,
      manual,
      quotedAt,
      stale,
      withoutPrice,
    };
  }
  if (fxRate === null) {
    return { costCents: 0, currentCents: 0, manual, quotedAt, stale, withoutPrice: true };
  }

  return {
    costCents: convert(position.cost, fxRate),
    currentCents: convert(position.currentValue ?? position.cost, fxRate),
    manual,
    quotedAt,
    stale,
    withoutPrice,
  };
}
// Spec 109 FR 9: the open calculated title with the earliest maturity on or after `today` (ties by name).
export function pickNextMaturity(views: AssetView[], today: string): NextMaturity | null {
  const candidates = views.filter(
    (view) =>
      view.fixedIncome !== null &&
      view.fixedIncome.today.gross > 0 &&
      view.fixedIncome.maturityDate >= today,
  );
  const [next] = candidates.sort(
    (a, b) =>
      (a.fixedIncome?.maturityDate ?? '').localeCompare(b.fixedIncome?.maturityDate ?? '') ||
      a.asset.name.localeCompare(b.asset.name),
  );

  return next?.fixedIncome
    ? {
        assetId: next.asset.id,
        currency: next.asset.currency,
        maturityDate: next.fixedIncome.maturityDate,
        name: next.asset.name,
        netEstimatedCents: next.fixedIncome.atMaturity.net,
      }
    : null;
}
export function summarizeHoldings(holdings: Holding[]): PortfolioTotals {
  const currentValueCents = holdings.reduce((sum, holding) => sum + holding.currentCents, 0);
  const investedCents = holdings.reduce((sum, holding) => sum + holding.costCents, 0);
  const resultCents = currentValueCents - investedCents;

  return {
    currentValueCents,
    investedCents,
    manualCount: holdings.filter((holding) => holding.manual).length,
    quotesAsOf: oldest(holdings.map((holding) => holding.quotedAt)),
    resultBasisPoints:
      investedCents === 0 ? null : Math.round((resultCents / investedCents) * 10000),
    resultCents,
    stale: holdings.some((holding) => holding.stale),
    withoutPrice: holdings.filter((holding) => holding.withoutPrice).length,
  };
}
// Spec 109 FR 8: USD income at the current rate; without a rate it is counted but not summed.
export function sumReceivedIncome(
  rows: { currency: string; netAmount: number }[],
  fxRate: null | string,
): { count: number; totalCents: number } {
  const totalCents = rows.reduce((sum, row) => {
    if (row.currency !== 'USD') {
      return sum + row.netAmount;
    }

    return fxRate === null ? sum : sum + convert(row.netAmount, fxRate);
  }, 0);

  return { count: rows.length, totalCents };
}

function convert(cents: number, rate: string): number {
  // `mulToCents` multiplies reais: the cents go in as a reais decimal.
  return Decimal8.parse((cents / 100).toFixed(2)).mulToCents(Decimal8.parse(rate));
}
function oldest(dates: (Date | null)[]): Date | null {
  return dates.reduce<Date | null>(
    (min, date) => (date !== null && (min === null || date < min) ? date : min),
    null,
  );
}
