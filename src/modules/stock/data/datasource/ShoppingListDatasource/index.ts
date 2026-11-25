import { Injectable } from '@nestjs/common';

import { Prisma, StockShoppingList } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import {
  dismissIfNeeded,
  syncOwnerRows,
  syncRestockRows,
} from '@stock/data/datasource/RestockSync';
import {
  AddShoppingListRowDatasourceParams,
  CreateShoppingListDatasourceParams,
  IShoppingListDatasource,
  ShoppingRowWithItem,
  UpdateShoppingListDatasourceParams,
  UpdateShoppingListRowDatasourceParams,
} from '@stock/data/repository/datasource/IShoppingListDatasource';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

type OwnerKey = { owner: StockShoppingList['owner']; owner_id: string };
type Tx = Prisma.TransactionClient;

const WITH_ITEM = {
  item: { include: { lots: { orderBy: { id: 'asc' as const }, where: { quantity: { gt: 0 } } } } },
  list: true,
};

// The items of the owner that have an AUTO row: the ones a default/archive change can move.
async function itemsWithAutoRows(tx: Tx, key: OwnerKey, listId?: string): Promise<string[]> {
  const rows = await tx.stockShoppingListRow.findMany({
    distinct: ['item_id'],
    select: { item_id: true },
    where: {
      item_id: { not: null },
      list: { ...key, id: listId },
      origin: { in: ['AUTO', 'FORECAST'] },
    },
  });

  return rows.map((row) => row.item_id as string);
}

// The items of the owner that can hold a FORECAST row: a computed OK forecast, or a forecast row already there.
async function itemsWithForecast(tx: Tx, key: OwnerKey): Promise<string[]> {
  const items = await tx.stockItem.findMany({
    select: { id: true },
    where: {
      ...key,
      OR: [{ forecast_status: 'OK' }, { shopping_list_rows: { some: { origin: 'FORECAST' } } }],
      stock_only: false,
    },
  });

  return items.map((item) => item.id);
}

@Injectable()
export class ShoppingListDatasource implements IShoppingListDatasource {
  constructor(private readonly db: Database) {}

  // Spec 118 FR 14/18: one row per item per list. Adding an item that is already there sums the quantities.
  async addRow(
    params: AddShoppingListRowDatasourceParams,
  ): Promise<{ merged: boolean; row: ShoppingRowWithItem }> {
    return this.db.client.$transaction(async (tx) => {
      let merged = false;
      let rowId: string;

      if (params.item_id) {
        const item = await tx.stockItem.findUniqueOrThrow({ where: { id: params.item_id } });
        const existing = await tx.stockShoppingListRow.findFirst({
          where: { item_id: params.item_id, list_id: params.list_id },
        });

        if (params.restore) {
          await tx.stockRestockDismissal.deleteMany({ where: { item_id: params.item_id } });
        }

        if (params.estimated_unit_price_cents !== undefined) {
          await tx.stockItem.update({
            data: { estimated_unit_price_cents: params.estimated_unit_price_cents },
            where: { id: item.id },
          });
        }

        if (existing && params.restore) {
          rowId = existing.id;
          await tx.stockShoppingListRow.update({
            data: { origin: params.origin ?? 'MANUAL', quantity: params.quantity },
            where: { id: existing.id },
          });
        } else if (existing) {
          merged = true;
          rowId = existing.id;
          await tx.stockShoppingListRow.update({
            data: {
              origin:
                existing.origin === 'AUTO' || existing.origin === 'FORECAST'
                  ? 'AUTO_EDITED'
                  : existing.origin,
              quantity: fromMilli(toMilli(Number(existing.quantity)) + toMilli(params.quantity)),
            },
            where: { id: existing.id },
          });
        } else {
          rowId = (
            await tx.stockShoppingListRow.create({
              data: {
                created_by: params.user_id,
                item_id: item.id,
                list_id: params.list_id,
                origin: params.restore ? (params.origin ?? 'MANUAL') : 'MANUAL',
                quantity: params.quantity,
              },
            })
          ).id;
        }
      } else {
        rowId = (
          await tx.stockShoppingListRow.create({
            data: {
              created_by: params.user_id,
              description: params.description,
              estimated_unit_price_cents: params.estimated_unit_price_cents,
              list_id: params.list_id,
              origin: 'MANUAL',
              quantity: params.quantity,
              unit: params.unit,
            },
          })
        ).id;
      }

      return {
        merged,
        row: await tx.stockShoppingListRow.findUniqueOrThrow({
          include: WITH_ITEM,
          where: { id: rowId },
        }),
      };
    });
  }

  // Setting the default clears the previous one in the same transaction and re-homes the AUTO rows (FR 3).
  async create(params: CreateShoppingListDatasourceParams): Promise<StockShoppingList> {
    return this.db.client.$transaction(async (tx) => {
      const key = { owner: params.owner, owner_id: params.owner_id };

      if (params.is_default) {
        await tx.stockShoppingList.updateMany({
          data: { is_default: false },
          where: { ...key, is_default: true },
        });
      }

      const created = await tx.stockShoppingList.create({ data: params });

      if (params.is_default) {
        await syncRestockRows(tx, await itemsWithAutoRows(tx, key), { forecast: 'reuse' });
      }

      return created;
    });
  }

  // Items and lists share the owner key; the items go first (`DeleteStockItemsByOwnerUseCase`), the cascade does
  // the rows.
  async deleteByOwner(key: OwnerKey): Promise<void> {
    await this.db.client.stockShoppingList.deleteMany({ where: key });
  }

  async deleteRow(rowId: string, userId: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      const row = await tx.stockShoppingListRow.findUnique({ where: { id: rowId } });

      if (!row) {
        return;
      }

      await tx.stockShoppingListRow.delete({ where: { id: rowId } });

      if (row.item_id) {
        await dismissIfNeeded(tx, row.item_id, userId);
      }
    });
  }

  // Concurrent first reads: the partial unique index makes the second insert a no-op, both then read the winner.
  async ensureDefault(key: OwnerKey, name: string): Promise<StockShoppingList> {
    const found = await this.db.client.stockShoppingList.findFirst({
      where: { ...key, is_default: true },
    });

    if (found) {
      return found;
    }

    const { count } = await this.db.client.stockShoppingList.createMany({
      data: [{ ...key, is_default: true, name }],
      skipDuplicates: true,
    });

    if (count > 0) {
      await this.db.client.$transaction(async (tx) => syncOwnerRows(tx, [key]));
    }

    return this.db.client.stockShoppingList.findFirstOrThrow({
      where: { ...key, is_default: true },
    });
  }

  async findById(id: string): Promise<null | StockShoppingList> {
    return this.db.client.stockShoppingList.findUnique({ where: { id } });
  }

  async findByOwners(keys: OwnerKey[], includeArchived: boolean): Promise<StockShoppingList[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.db.client.stockShoppingList.findMany({
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      where: { OR: keys, ...(includeArchived ? {} : { status: 'ACTIVE' }) },
    });
  }

  // Spec 123 FR 10: the dates of the last 7 CLOSED purchases of each list, newest first (one statement).
  async findClosedPurchaseDates(
    listIds: string[],
  ): Promise<{ list_id: string; purchase_date: Date }[]> {
    if (listIds.length === 0) {
      return [];
    }

    return this.db.client.$queryRaw<{ list_id: string; purchase_date: Date }[]>(Prisma.sql`
      SELECT t."list_id" AS "list_id", t."purchase_date" AS "purchase_date" FROM (
        SELECT p."list_id", p."purchase_date",
          row_number() OVER (PARTITION BY p."list_id" ORDER BY p."purchase_date" DESC, p."closed_at" DESC) AS "rn"
        FROM "stock_purchases" p
        WHERE p."list_id" IN (${Prisma.join(listIds)}) AND p."status" = 'CLOSED'
      ) t
      WHERE t."rn" <= 7
      ORDER BY t."list_id", t."purchase_date" DESC
    `);
  }

  async findRestockRows(keys: OwnerKey[]): Promise<ShoppingRowWithItem[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.db.client.stockShoppingListRow.findMany({
      include: WITH_ITEM,
      orderBy: { id: 'asc' },
      where: {
        list: { OR: keys, status: 'ACTIVE' },
        origin: { in: ['AUTO', 'AUTO_EDITED', 'FORECAST'] },
      },
    });
  }

  async findRowById(id: string): Promise<null | ShoppingRowWithItem> {
    return this.db.client.stockShoppingListRow.findUnique({ include: WITH_ITEM, where: { id } });
  }

  async findRowsByLists(listIds: string[]): Promise<ShoppingRowWithItem[]> {
    if (listIds.length === 0) {
      return [];
    }

    return this.db.client.stockShoppingListRow.findMany({
      include: WITH_ITEM,
      orderBy: { id: 'asc' },
      where: { list_id: { in: listIds } },
    });
  }

  // Archiving, reactivating and the default switch re-home the AUTO rows through the shared sync (FR 3/4).
  async update(params: UpdateShoppingListDatasourceParams): Promise<StockShoppingList> {
    const { id, ...data } = params;

    return this.db.client.$transaction(async (tx) => {
      const current = await tx.stockShoppingList.findUniqueOrThrow({ where: { id } });
      const key = { owner: current.owner, owner_id: current.owner_id };
      const movedItems =
        data.status === 'ARCHIVED' && current.status === 'ACTIVE'
          ? await itemsWithAutoRows(tx, key, id)
          : [];

      if (data.is_default) {
        await tx.stockShoppingList.updateMany({
          data: { is_default: false },
          where: { ...key, id: { not: id }, is_default: true },
        });
      }

      const updated = await tx.stockShoppingList.update({ data, where: { id } });

      // Spec 123 FR 12: a new interval moves the next trip, so the items that can have a FORECAST row are re-evaluated.
      const intervalItems =
        data.purchase_interval_days !== undefined &&
        data.purchase_interval_days !== current.purchase_interval_days
          ? await itemsWithForecast(tx, key)
          : [];

      if (data.is_default && !current.is_default) {
        await syncRestockRows(
          tx,
          [...new Set([...(await itemsWithAutoRows(tx, key)), ...intervalItems])],
          { forecast: 'reuse' },
        );
      } else {
        await syncRestockRows(tx, [...new Set([...intervalItems, ...movedItems])], {
          forecast: 'reuse',
        });
      }

      return updated;
    });
  }

  // FR 12: changing the quantity of an AUTO row freezes it as AUTO_EDITED. The typed price of an item row lives on
  // the item (FR 22).
  async updateRow(params: UpdateShoppingListRowDatasourceParams): Promise<ShoppingRowWithItem> {
    const { estimated_unit_price_cents: price, id, ...data } = params;

    return this.db.client.$transaction(async (tx) => {
      const current = await tx.stockShoppingListRow.findUniqueOrThrow({ where: { id } });
      const edited =
        data.quantity !== undefined &&
        toMilli(data.quantity) !== toMilli(Number(current.quantity)) &&
        (current.origin === 'AUTO' || current.origin === 'FORECAST');

      if (current.item_id) {
        if (price !== undefined) {
          await tx.stockItem.update({
            data: { estimated_unit_price_cents: price },
            where: { id: current.item_id },
          });
        }

        await tx.stockShoppingListRow.update({
          data: { origin: edited ? 'AUTO_EDITED' : undefined, quantity: data.quantity },
          where: { id },
        });
      } else {
        await tx.stockShoppingListRow.update({
          data: { ...data, estimated_unit_price_cents: price },
          where: { id },
        });
      }

      return tx.stockShoppingListRow.findUniqueOrThrow({ include: WITH_ITEM, where: { id } });
    });
  }
}
