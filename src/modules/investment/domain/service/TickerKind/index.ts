import { InvestmentAssetClass } from '@investment/domain/enum';
import type { B3TickerKind } from '@shared/infra/quotes/types';

// Spec 111 rule 2: the class a B3 instrument kind requires; Fiagro and unknown kinds have no rule.
export function classOfTickerKind(kind: B3TickerKind): InvestmentAssetClass | null {
  if (kind === 'STOCK' || kind === 'ETF' || kind === 'BDR') {
    return InvestmentAssetClass.BR_STOCK;
  }

  return kind === 'REIT' ? InvestmentAssetClass.BR_REIT : null;
}
