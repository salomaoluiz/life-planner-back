import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

// Spec 118 FR 14: adding an item that is already on the list sums the quantities; an AUTO row becomes
// AUTO_EDITED ("yours"), a MANUAL one stays MANUAL.
export function mergeRow(
  current: { origin: ShoppingListRowOrigins; quantity: number },
  added: number,
): { origin: ShoppingListRowOrigins; quantity: number } {
  return {
    origin:
      current.origin === ShoppingListRowOrigins.AUTO ||
      current.origin === ShoppingListRowOrigins.FORECAST
        ? ShoppingListRowOrigins.AUTO_EDITED
        : current.origin,
    quantity: fromMilli(toMilli(current.quantity) + toMilli(added)),
  };
}
