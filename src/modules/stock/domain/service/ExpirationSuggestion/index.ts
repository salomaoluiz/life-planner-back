import StockLotEntity from '@stock/domain/entity/StockLotEntity';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 365;

// Spec 120 FR 31: purchase date + the median of (expiration − purchase) of the item's lots dated in the last 12
// months, rounded to days; nothing without such a lot.
export function suggestExpiration(
  lots: Pick<StockLotEntity, 'expirationDate' | 'purchaseDate'>[],
  purchaseDate: Date,
): Date | undefined {
  const since = purchaseDate.getTime() - WINDOW_DAYS * DAY_MS;
  const spans = lots
    .filter(
      (lot) =>
        lot.expirationDate !== undefined &&
        lot.purchaseDate !== undefined &&
        lot.purchaseDate.getTime() >= since,
    )
    .map((lot) =>
      Math.round(
        ((lot.expirationDate as Date).getTime() - (lot.purchaseDate as Date).getTime()) / DAY_MS,
      ),
    )
    .sort((a, b) => a - b);

  if (spans.length === 0) {
    return undefined;
  }

  const middle = Math.floor(spans.length / 2);
  const median = spans.length % 2 === 1 ? spans[middle] : (spans[middle - 1] + spans[middle]) / 2;

  return new Date(purchaseDate.getTime() + Math.round(median) * DAY_MS);
}
