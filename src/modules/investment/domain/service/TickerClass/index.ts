import { InvestmentAssetClass } from '@investment/domain/enum';
import type { B3TickerKind } from '@shared/infra/quotes/types';

// Spec 111 rule 2: the class a B3 instrument kind requires. No rule for a Fiagro or an unknown kind, so the owner
// keeps the class they chose.
export function classOfTickerKind(kind: B3TickerKind): InvestmentAssetClass | null {
  switch (kind) {
    case 'BDR':
    case 'ETF':
    case 'STOCK':
      return InvestmentAssetClass.BR_STOCK;
    case 'REIT':
      return InvestmentAssetClass.BR_REIT;
    default:
      return null;
  }
}
