import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { InvestmentAssetClass } from '@investment/domain/enum';

export type AssetPairViolation = 'DIFFERENT_CLASS_OR_CURRENCY' | 'FIXED_INCOME';

// Spec 112 FR 2: two assets of the same class and currency, neither fixed income.
export function checkAssetPair(
  origin: { assetClass: InvestmentAssetClass; currency: string },
  destination: { assetClass: InvestmentAssetClass; currency: string },
): AssetPairViolation | null {
  if (
    origin.assetClass === InvestmentAssetClass.FIXED_INCOME ||
    destination.assetClass === InvestmentAssetClass.FIXED_INCOME
  ) {
    return 'FIXED_INCOME';
  }

  return origin.assetClass === destination.assetClass && origin.currency === destination.currency
    ? null
    : 'DIFFERENT_CLASS_OR_CURRENCY';
}

// Spec 112 FR 5: every operation (BUY, SELL, events, conversions in) dated after the record date; `ignoreIds` skips the
// conversion being edited.
export function operationsAfter<T extends Pick<OperationEntity, 'date' | 'id' | 'type'>>(
  operations: T[],
  date: string,
  ignoreIds: string[] = [],
): T[] {
  return operations.filter(
    (operation) => operation.date > date && !ignoreIds.includes(operation.id),
  );
}
