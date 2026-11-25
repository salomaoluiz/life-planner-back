import { Prisma } from '@db/client';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import {
  buildWindowDays,
  computeForecast,
  DayMovements,
  leftoverFor,
  pickLeftover,
  wasteRatio,
} from '@stock/domain/service/ConsumptionForecast';
import { addDays, effectiveExpiration } from '@stock/domain/service/LotExpiration';
import { toMilli } from '@stock/domain/service/StockQuantity';

interface ForecastRecord {
  computedOn: Date;
  dailyRate: null | number;
  emptyDate: Date | null;
  itemId: string;
  leftoverDate: Date | null;
  leftoverLotId: null | string;
  leftoverQuantity: null | number;
  minDate: Date | null;
  status: null | string;
  wasteRatio: null | number;
}
interface MovementRow {
  age_days: number;
  count: number;
  item_id: string;
  quantity: number;
  type: string;
}
type Tx = Prisma.TransactionClient;

export const FORECAST_WINDOW_DAYS = 90;
const CHUNK_SIZE = 500;

// Spec 123 FR 13: the forecast of the items, recomputed inside the caller's transaction (three reads and one
// `UPDATE ... FROM (VALUES)` per 500 items, whatever the item count).
export async function recomputeForecasts(tx: Tx, itemIds: string[], today: Date): Promise<void> {
  if (itemIds.length === 0) {
    return;
  }

  const items = await tx.stockItem.findMany({
    select: {
      id: true,
      min_quantity: true,
      opened_shelf_life_days: true,
      stock_only: true,
      unit: true,
    },
    where: { id: { in: itemIds } },
  });
  const lots = await tx.stockLot.findMany({
    select: {
      expiration_date: true,
      id: true,
      item_id: true,
      leftover_dismissed_at: true,
      leftover_dismissed_quantity: true,
      opened_at: true,
      quantity: true,
    },
    where: { item_id: { in: itemIds }, quantity: { gt: 0 } },
  });
  const rows = await readMovements(
    tx,
    items.map((item) => item.id),
    today,
  );
  const records = items.map((item): ForecastRecord => {
    const itemLots = lots.filter((lot) => lot.item_id === item.id);

    if (item.stock_only) {
      return emptyRecord(item.id, today);
    }

    const quantity = itemLots.reduce((sum, lot) => sum + toMilli(Number(lot.quantity)), 0) / 1000;
    const summary = summarize(rows.filter((row) => row.item_id === item.id));
    const unit = item.unit as StockUnits;
    const forecast = computeForecast({
      consumeCount: summary.consumeCount,
      days: buildWindowDays(quantity, summary.perDay, FORECAST_WINDOW_DAYS),
      minQuantity: item.min_quantity === null ? undefined : Number(item.min_quantity),
      quantity,
      spanDays: summary.spanDays,
      today,
      unit,
    });
    const leftover =
      forecast.status === 'OK'
        ? pickLeftover(
            leftoverFor({
              lots: itemLots.map((lot) => ({
                effectiveExpiration: effectiveExpiration(
                  {
                    expirationDate: lot.expiration_date ?? undefined,
                    openedAt: lot.opened_at ?? undefined,
                  },
                  item.opened_shelf_life_days ?? undefined,
                ),
                id: lot.id,
                openedAt: lot.opened_at ?? undefined,
                quantity: Number(lot.quantity),
              })),
              rate: forecast.dailyRate,
              today,
              unit,
            }),
            new Map(
              itemLots
                .filter(
                  (lot) => lot.leftover_dismissed_at && lot.leftover_dismissed_quantity !== null,
                )
                .map((lot) => [lot.id, Number(lot.leftover_dismissed_quantity)]),
            ),
            unit,
          )
        : null;

    return {
      computedOn: today,
      dailyRate: forecast.status === 'OK' ? forecast.dailyRate : null,
      emptyDate: forecast.emptyDate ?? null,
      itemId: item.id,
      leftoverDate: leftover?.date ?? null,
      leftoverLotId: leftover?.lotId ?? null,
      leftoverQuantity: leftover?.quantity ?? null,
      minDate: forecast.minDate ?? null,
      status: forecast.status,
      wasteRatio: wasteRatio(summary.discarded, summary.entered),
    };
  });

  for (let start = 0; start < records.length; start += CHUNK_SIZE) {
    await tx.$executeRaw(updateStatement(records.slice(start, start + CHUNK_SIZE)));
  }
}

function emptyRecord(itemId: string, today: Date): ForecastRecord {
  return {
    computedOn: today,
    dailyRate: null,
    emptyDate: null,
    itemId,
    leftoverDate: null,
    leftoverLotId: null,
    leftoverQuantity: null,
    minDate: null,
    status: null,
    wasteRatio: null,
  };
}
// One grouped statement for every item: the movements of the window by item, day and type (OPEN does not change the
// quantity and is left out).
async function readMovements(tx: Tx, itemIds: string[], today: Date): Promise<MovementRow[]> {
  const from = addDays(today, -FORECAST_WINDOW_DAYS);

  return tx.$queryRaw<MovementRow[]>(Prisma.sql`
    SELECT m."item_id" AS "item_id",
      (${today}::date - (m."created_at" AT TIME ZONE 'UTC')::date)::int AS "age_days",
      m."type"::text AS "type", SUM(m."quantity")::float8 AS "quantity", COUNT(*)::int AS "count"
    FROM "stock_movements" m
    WHERE m."item_id" IN (${Prisma.join(itemIds)}) AND m."created_at" >= ${from}::date AND m."type" <> 'OPEN'
    GROUP BY 1, 2, 3
  `);
}
function summarize(rows: MovementRow[]) {
  const perDay = new Map<number, DayMovements>();
  let consumeCount = 0;
  let discarded = 0;
  let entered = 0;
  let newest = Infinity;
  let oldest = -Infinity;

  for (const row of rows) {
    const day = perDay.get(row.age_days) ?? { ageDays: row.age_days, consumed: 0, delta: 0 };

    day.delta += row.quantity;

    if (row.type === 'CONSUME') {
      day.consumed += -row.quantity;

      if (row.age_days >= 1) {
        consumeCount += row.count;
        newest = Math.min(newest, row.age_days);
        oldest = Math.max(oldest, row.age_days);
      }
    } else if (row.type === 'DISCARD') {
      discarded += -row.quantity;
    } else if (row.type === 'ENTRY' || row.type === 'INITIAL') {
      entered += row.quantity;
    }

    perDay.set(row.age_days, day);
  }

  return {
    consumeCount,
    discarded,
    entered,
    perDay: [...perDay.values()],
    spanDays: consumeCount > 0 ? oldest - newest : 0,
  };
}
function updateStatement(records: ForecastRecord[]): Prisma.Sql {
  const tuples = records.map(
    (
      record,
    ) => Prisma.sql`(${record.itemId}::text, ${record.status}::text, ${record.dailyRate}::numeric,
      ${record.minDate}::date, ${record.emptyDate}::date, ${record.leftoverLotId}::text,
      ${record.leftoverQuantity}::numeric, ${record.leftoverDate}::date, ${record.wasteRatio}::numeric,
      ${record.computedOn}::date)`,
  );

  return Prisma.sql`
    UPDATE "stock_items" AS t SET
      "forecast_status" = v."status"::"StockForecastStatus", "forecast_daily_rate" = v."rate",
      "forecast_min_date" = v."min_date", "forecast_empty_date" = v."empty_date",
      "forecast_leftover_lot_id" = v."lot_id", "forecast_leftover_quantity" = v."lot_quantity",
      "forecast_leftover_date" = v."lot_date", "forecast_waste_ratio_90d" = v."waste",
      "forecast_computed_on" = v."computed_on"
    FROM (VALUES ${Prisma.join(tuples, ', ')})
      AS v("id", "status", "rate", "min_date", "empty_date", "lot_id", "lot_quantity", "lot_date", "waste", "computed_on")
    WHERE t."id" = v."id"
  `;
}
