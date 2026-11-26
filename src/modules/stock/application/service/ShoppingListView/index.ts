import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';
import StockCategoryEntity from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import { ShoppingRowRecord } from '@stock/domain/repository';
import { pathOf } from '@stock/domain/service/CategoryTree';
import { projectedOnTrip } from '@stock/domain/service/ConsumptionForecast';
import {
  PriceSource,
  resolveUnitPrice,
  rowEstimateCents,
  summarizeEstimates,
} from '@stock/domain/service/ListEstimate';
import { groupRows } from '@stock/domain/service/ListGrouping';
import { nextTripDate, suggestedInterval } from '@stock/domain/service/NextTrip';
import { todayUtc } from '@stock/domain/service/Today';

export interface ListSchedule {
  nextTripDate: Date;
  suggestedIntervalDays: null | number;
}
export interface ShoppingListCard {
  autoCount: number;
  estimatedTotalCents: number;
  forecastCount: number;
  list: ShoppingListEntity;
  pricedCount: number;
  rowCount: number;
  schedule: ListSchedule;
}
export interface ShoppingListDetail {
  groups: ShoppingRowGroup[];
  list: ShoppingListEntity;
  schedule: ListSchedule;
  totals: {
    autoCount: number;
    estimatedTotalCents: number;
    forecastCount: number;
    pricedCount: number;
    rowCount: number;
  };
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
  // Spec 123 FR 17: only on FORECAST rows.
  forecast?: { minDate: Date; nextTripDate: Date; projectedOnTrip: number };
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
  wasteRatio90d?: number;
}

function isAuto(origin: ShoppingListRowOrigins) {
  return origin !== ShoppingListRowOrigins.MANUAL;
}

// Spec 118 FR 20-22: the price of an item row lives on the item, the one of a text row on the row.
export function toRowView(
  record: ShoppingRowRecord,
  categories: StockCategoryEntity[] = [],
  schedule?: ListSchedule,
  today: Date = todayUtc(),
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
    forecast: forecastOf(record, schedule, today),
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
    wasteRatio90d: item?.forecast?.wasteRatio90d,
  };
}

function forecastOf(
  record: ShoppingRowRecord,
  schedule: ListSchedule | undefined,
  today: Date,
): ShoppingRowView['forecast'] {
  const forecast = record.item?.forecast;

  if (
    record.row.origin !== ShoppingListRowOrigins.FORECAST ||
    !schedule ||
    !record.item ||
    !forecast?.minDate ||
    forecast.dailyRate === undefined
  ) {
    return undefined;
  }

  const daysToTrip = Math.round((schedule.nextTripDate.getTime() - today.getTime()) / 86_400_000);

  return {
    minDate: forecast.minDate,
    nextTripDate: schedule.nextTripDate,
    projectedOnTrip: projectedOnTrip(record.item.quantity, forecast.dailyRate, daysToTrip),
  };
}

// Spec 123 FR 10-11: the next trip and the suggestion of one list from its closed purchases.
export function scheduleOf(
  list: ShoppingListEntity,
  closedDates: Date[] = [],
  today: Date = todayUtc(),
): ListSchedule {
  return {
    nextTripDate: nextTripDate(closedDates[0], list.purchaseIntervalDays, today),
    suggestedIntervalDays: suggestedInterval(closedDates),
  };
}

// The cards of the lists screen: counts and the estimate of each list from its rows.
export function toListCards(
  lists: ShoppingListEntity[],
  records: ShoppingRowRecord[],
  closedDates: Map<string, Date[]> = new Map(),
  today: Date = todayUtc(),
): ShoppingListCard[] {
  return lists.map((list) => {
    const rows = records.filter((record) => record.row.listId === list.id).map((r) => toRowView(r));

    return {
      autoCount: rows.filter((row) => isAuto(row.origin)).length,
      forecastCount: rows.filter((row) => row.origin === ShoppingListRowOrigins.FORECAST).length,
      list,
      schedule: scheduleOf(list, closedDates.get(list.id), today),
      ...summarizeEstimates(rows.map((row) => row.estimateCents)),
    };
  });
}

// Spec 118 FR 19: rows grouped by the top-level category of the item (the full path shows on the row).
export function toListDetail(
  list: ShoppingListEntity,
  records: ShoppingRowRecord[],
  categories: StockCategoryEntity[],
  closedDates: Date[] = [],
  today: Date = todayUtc(),
): ShoppingListDetail {
  const schedule = scheduleOf(list, closedDates, today);
  const rows = records.map((record) => toRowView(record, categories, schedule, today));
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
    schedule,
    totals: {
      autoCount: rows.filter((row) => isAuto(row.origin)).length,
      forecastCount: rows.filter((row) => row.origin === ShoppingListRowOrigins.FORECAST).length,
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
