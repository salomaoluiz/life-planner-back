import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';
import StockCategoryEntity from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import { ShoppingRowRecord } from '@stock/domain/repository';
import { pathOf } from '@stock/domain/service/CategoryTree';
import {
  PriceSource,
  resolveUnitPrice,
  rowEstimateCents,
  summarizeEstimates,
} from '@stock/domain/service/ListEstimate';
import { groupRows } from '@stock/domain/service/ListGrouping';

export interface ShoppingListCard {
  autoCount: number;
  estimatedTotalCents: number;
  list: ShoppingListEntity;
  pricedCount: number;
  rowCount: number;
}
export interface ShoppingListDetail {
  groups: ShoppingRowGroup[];
  list: ShoppingListEntity;
  totals: { autoCount: number; estimatedTotalCents: number; pricedCount: number; rowCount: number };
}
export interface ShoppingRowGroup {
  category?: { archived: boolean; id: string; name: string; path: string };
  rows: ShoppingRowView[];
  subtotalCents: number;
  unpricedCount: number;
}
export interface ShoppingRowView {
  categoryId?: string;
  description: string;
  estimateCents?: number;
  id: string;
  itemId?: string;
  origin: ShoppingListRowOrigins;
  priceSource: PriceSource;
  quantity: number;
  stock?: {
    categoryPath?: string;
    idealQuantity?: number;
    minQuantity?: number;
    quantity: number;
  };
  unit: StockUnits;
  unitPriceCents?: number;
}

function isAuto(origin: ShoppingListRowOrigins) {
  return origin !== ShoppingListRowOrigins.MANUAL;
}

// Spec 118 FR 20-22: the price of an item row lives on the item, the one of a text row on the row.
export function toRowView(
  record: ShoppingRowRecord,
  categories: StockCategoryEntity[] = [],
): ShoppingRowView {
  const { item, row } = record;
  const { priceSource, unitPriceCents } = resolveUnitPrice(
    item ? item.estimatedUnitPriceCents : row.estimatedUnitPriceCents,
  );

  return {
    categoryId: item?.categoryId,
    description: item?.description ?? row.description ?? '',
    estimateCents:
      unitPriceCents === undefined ? undefined : rowEstimateCents(unitPriceCents, row.quantity),
    id: row.id,
    itemId: row.itemId,
    origin: row.origin,
    priceSource,
    quantity: row.quantity,
    stock: item && {
      categoryPath: item.categoryId ? pathOf(categories, item.categoryId) : undefined,
      idealQuantity: item.idealQuantity,
      minQuantity: item.minQuantity,
      quantity: item.quantity,
    },
    unit: item?.unit ?? row.unit ?? StockUnits.UNIT,
    unitPriceCents,
  };
}

// The cards of the lists screen: counts and the estimate of each list from its rows.
export function toListCards(
  lists: ShoppingListEntity[],
  records: ShoppingRowRecord[],
): ShoppingListCard[] {
  return lists.map((list) => {
    const rows = records.filter((record) => record.row.listId === list.id).map((r) => toRowView(r));

    return {
      autoCount: rows.filter((row) => isAuto(row.origin)).length,
      list,
      ...summarizeEstimates(rows.map((row) => row.estimateCents)),
    };
  });
}

// Spec 118 FR 19: rows grouped by the top-level category of the item (the full path shows on the row).
export function toListDetail(
  list: ShoppingListEntity,
  records: ShoppingRowRecord[],
  categories: StockCategoryEntity[],
): ShoppingListDetail {
  const rows = records.map((record) => toRowView(record, categories));
  const byId = new Map(categories.map((category) => [category.id, category]));
  const groups = groupRows(
    rows.map((row) => ({ ...row, categoryId: rootOf(categories, row.categoryId) })),
    (categoryId) => byId.get(categoryId)?.name,
  ).map((group) => {
    const root = group.categoryId ? byId.get(group.categoryId) : undefined;

    return {
      category: root && {
        archived: root.status === 'ARCHIVED',
        id: root.id,
        name: root.name,
        path: root.name,
      },
      rows: group.rows,
      subtotalCents: group.subtotalCents,
      unpricedCount: group.unpricedCount,
    };
  });

  return {
    groups,
    list,
    totals: {
      autoCount: rows.filter((row) => isAuto(row.origin)).length,
      ...summarizeEstimates(rows.map((row) => row.estimateCents)),
    },
  };
}

function rootOf(categories: StockCategoryEntity[], categoryId?: string): string | undefined {
  let current = categories.find((candidate) => candidate.id === categoryId);

  while (current?.parentId) {
    const parent = categories.find((candidate) => candidate.id === current?.parentId);

    if (!parent) {
      break;
    }

    current = parent;
  }

  return current?.id;
}
