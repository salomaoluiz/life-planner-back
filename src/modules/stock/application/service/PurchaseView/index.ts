import PurchaseEntity from '@stock/domain/entity/PurchaseEntity';
import {
  LastPrice,
  OtherCart,
  PurchaseRowRecord,
  ShoppingRowRecord,
} from '@stock/domain/repository';
import { rowEstimateCents } from '@stock/domain/service/ListEstimate';
import {
  cartTotals,
  priceChangeNotice,
  priceChangePercent,
} from '@stock/domain/service/PurchaseMath';

export interface PurchaseRowView {
  checkedAt: Date;
  checkedBy?: { id: string; name: string };
  description: string;
  expirationDate?: Date;
  id: string;
  itemId?: string;
  lastPrice?: LastPrice;
  lineTotalCents?: number;
  listRowId?: string;
  priceChangeNotice: 'CHEAPER' | 'NONE' | 'UP';
  priceChangePercent: null | number;
  priceInput?: PurchaseRowRecord['priceInput'];
  quantity?: number;
  state: PurchaseRowRecord['state'];
  unit?: PurchaseRowRecord['unit'];
  unitPriceCents?: number;
  unknownPrice: boolean;
}
export interface PurchaseView {
  cart: { count: number; totalCents: number; unpricedCount: number };
  forecastCents: number;
  otherCarts: OtherCart[];
  purchase: PurchaseEntity;
  remaining: { count: number; estimatedCents: number; pricedCount: number };
  rows: PurchaseRowView[];
}

export function toPurchaseRowView(
  row: PurchaseRowRecord,
  lastPrices: Map<string, LastPrice>,
): PurchaseRowView {
  const lastPrice = row.itemId ? lastPrices.get(row.itemId) : undefined;
  const percent = priceChangePercent(lastPrice?.unitPriceCents, row.unitPriceCents);

  return {
    checkedAt: row.checkedAt,
    checkedBy: row.checkedBy,
    description: row.item?.description ?? row.description ?? '',
    expirationDate: row.expirationDate,
    id: row.id,
    itemId: row.itemId,
    lastPrice,
    lineTotalCents: row.lineTotalCents,
    listRowId: row.listRowId,
    priceChangeNotice: priceChangeNotice(percent),
    priceChangePercent: percent,
    priceInput: row.priceInput,
    quantity: row.quantity,
    state: row.state,
    unit: row.unit ?? row.item?.unit,
    unitPriceCents: row.unitPriceCents,
    unknownPrice: row.unknownPrice,
  };
}

// Spec 120 FR 19: the rows of the list that are in no open purchase (and not "Não tinha") are what remains;
// their estimate is the manual price or, without one, the last price at this market.
export function toPurchaseView(input: {
  lastPrices: Map<string, LastPrice>;
  listRows: ShoppingRowRecord[];
  otherCarts: OtherCart[];
  purchase: PurchaseEntity;
  purchaseRows: PurchaseRowRecord[];
  // Rows of every OPEN/ENDED purchase of the list (this one included).
  takenListRowIds: Set<string>;
}): PurchaseView {
  const rows = input.purchaseRows.map((row) => toPurchaseRowView(row, input.lastPrices));
  const cart = cartTotals(
    rows.map((row) => ({ inCart: row.state === 'IN_CART', lineTotalCents: row.lineTotalCents })),
  );
  const notFound = new Set(
    input.purchaseRows.filter((row) => row.state === 'NOT_FOUND').map((row) => row.listRowId),
  );
  const remainingRows = input.listRows.filter(
    ({ row }) => !input.takenListRowIds.has(row.id) && !notFound.has(row.id),
  );
  const estimates = remainingRows.map(({ item, row }) => {
    const unitPrice = item
      ? (item.estimatedUnitPriceCents ?? input.lastPrices.get(item.id)?.unitPriceCents)
      : row.estimatedUnitPriceCents;

    return unitPrice === undefined ? undefined : rowEstimateCents(unitPrice, row.quantity);
  });
  const estimatedCents = estimates.reduce<number>((sum, value) => sum + (value ?? 0), 0);

  return {
    cart,
    forecastCents: cart.totalCents + estimatedCents,
    otherCarts: input.otherCarts,
    purchase: input.purchase,
    remaining: {
      count: remainingRows.length,
      estimatedCents,
      pricedCount: estimates.filter((value) => value !== undefined).length,
    },
    rows,
  };
}
