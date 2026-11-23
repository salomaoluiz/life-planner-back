import { PurchaseView, toPurchaseView } from '@stock/application/service/PurchaseView';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { IPurchaseRepository, IShoppingListRepository } from '@stock/domain/repository';

// Spec 120 FR 19-20: one read of the list rows, the rows of its open purchases, the last prices at the market and
// the rows checked in other carts, shared by every purchase of the list.
export async function loadPurchaseViews(
  repositories: { lists: IShoppingListRepository; purchases: IPurchaseRepository },
  listId: string,
  purchases: PurchaseEntity[],
): Promise<PurchaseView[]> {
  if (purchases.length === 0) {
    return [];
  }

  const [listRows, active] = await Promise.all([
    repositories.lists.findRowsByLists([listId]),
    repositories.purchases.findByList(listId, [PurchaseStatuses.OPEN, PurchaseStatuses.ENDED]),
  ]);
  const ids = [...new Set([...purchases, ...active].map((purchase) => purchase.id))];
  const allRows = await repositories.purchases.findRows(ids);
  const taken = new Set(
    allRows
      .filter(
        (row) =>
          row.listRowId !== undefined &&
          row.state === 'IN_CART' &&
          active.some((purchase) => purchase.id === row.purchaseId),
      )
      .map((row) => row.listRowId as string),
  );

  return Promise.all(
    purchases.map(async (purchase) => {
      const purchaseRows = allRows.filter((row) => row.purchaseId === purchase.id);
      const itemIds = [
        ...new Set([
          ...listRows.flatMap(({ item }) => (item ? [item.id] : [])),
          ...purchaseRows.flatMap((row) => (row.itemId ? [row.itemId] : [])),
        ]),
      ];
      const [lastPrices, otherCarts] = await Promise.all([
        repositories.purchases.findLastPrices(itemIds, purchase.marketId),
        repositories.purchases.findOtherCarts(listId, purchase.id),
      ]);

      return toPurchaseView({
        lastPrices,
        listRows,
        otherCarts,
        purchase,
        purchaseRows,
        takenListRowIds: taken,
      });
    }),
  );
}
