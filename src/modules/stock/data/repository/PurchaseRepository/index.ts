import { ConflictException, Injectable } from '@nestjs/common';

import {
  OwnerType,
  Prisma,
  PurchaseRowState,
  StockPurchase,
  StockPurchaseRow,
  StockPurchaseStatus,
  StockUnit,
} from '@db/client';
import { OwnerType as DomainOwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';
import { toOwnerWhere } from '@stock/data/datasource/mapper/OwnerWhere';
import { syncRestockRows } from '@stock/data/datasource/RestockSync';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import PurchaseEntity, { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import {
  ClosedPurchaseResult,
  ClosePurchaseParams,
  FinanceReference,
  IPurchaseRepository,
  LastPrice,
  OtherCart,
  PendingPurchase,
  PriceHistoryPoint,
  PurchaseEventRecord,
  PurchaseRowRecord,
  PurchaseWithRows,
  UpsertPurchaseRowParams,
  UpsertPurchaseRowResult,
} from '@stock/domain/repository';
import { unitFromLine } from '@stock/domain/service/PurchaseMath';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

type RowWithRelations = Prisma.StockPurchaseRowGetPayload<{
  include: { checker: { select: { id: true; name: true } }; item: true };
}>;
type Tx = Prisma.TransactionClient;

const ROW_INCLUDE = {
  checker: { select: { id: true, name: true } },
  item: true,
} as const;
const EVENT_CHANNEL = 'stock_list_events';
// FR 8: an OPEN purchase idle for this long (or every ENDED one) is a forgotten purchase.
const FORGOTTEN_AFTER_MS = 12 * 60 * 60 * 1000;
const CLOSING_LOCK_MS = 15 * 60 * 1000;

export function toPurchase(raw: StockPurchase): PurchaseEntity {
  return new PurchaseEntity({
    accountId: raw.account_id ?? undefined,
    closedAt: raw.closed_at ?? undefined,
    closedBy: raw.closed_by ?? undefined,
    closingAt: raw.closing_at ?? undefined,
    closingBy: raw.closing_by ?? undefined,
    creditCardId: raw.credit_card_id ?? undefined,
    currency: raw.currency,
    endedAt: raw.ended_at ?? undefined,
    id: raw.id,
    invoiceMonth: raw.invoice_month ?? undefined,
    lastActivityAt: raw.last_activity_at,
    listId: raw.list_id,
    marketId: raw.market_id,
    owner: DomainOwnerType[raw.owner],
    ownerId: raw.owner_id,
    purchaseDate: raw.purchase_date,
    receiptTotalCents: raw.receipt_total_cents ?? undefined,
    splitId: raw.split_id ?? undefined,
    startedAt: raw.started_at,
    startedBy: raw.started_by ?? undefined,
    status: PurchaseStatuses[raw.status],
    transactionId: raw.transaction_id ?? undefined,
  });
}
export function toRow(raw: RowWithRelations | StockPurchaseRow): PurchaseRowRecord {
  const full = raw as RowWithRelations;

  return {
    barcode: raw.barcode ?? undefined,
    checkedAt: raw.checked_at,
    checkedBy: full.checker ? { id: full.checker.id, name: full.checker.name } : undefined,
    description: raw.description ?? undefined,
    entryMovementId: raw.entry_movement_id ?? undefined,
    expirationDate: raw.expiration_date ?? undefined,
    id: raw.id,
    item: full.item
      ? {
          categoryId: full.item.category_id ?? undefined,
          description: full.item.description,
          id: full.item.id,
          unit: full.item.unit as StockUnits,
        }
      : undefined,
    itemId: raw.item_id ?? undefined,
    lineTotalCents: raw.line_total_cents ?? undefined,
    listRowId: raw.list_row_id ?? undefined,
    priceInput: raw.price_input ?? undefined,
    purchaseId: raw.purchase_id,
    quantity: toNumber(raw.quantity),
    state: raw.state,
    unit: (raw.unit as null | StockUnits) ?? undefined,
    unitPriceCents: raw.unit_price_cents ?? undefined,
    unknownPrice: raw.unknown_price,
  };
}

function toNumber(value: { toString(): string } | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : Number(value.toString());
}

// FR 23: the event row and the NOTIFY (delivered at commit) are written in the writing transaction.
async function emit(
  tx: Tx,
  purchase: { id: string; list_id: string },
  type: string,
  payload: unknown,
  userId?: string,
  clientId?: string,
): Promise<void> {
  const data = JSON.stringify(payload);

  await tx.$executeRaw(Prisma.sql`
    WITH inserted AS (
      INSERT INTO "stock_purchase_events" ("list_id", "purchase_id", "type", "payload", "client_id", "user_id")
      VALUES (${purchase.list_id}, ${purchase.id}::uuid, ${type}, ${data}::jsonb, ${clientId ?? null}::uuid, ${userId ?? null})
      RETURNING "id"
    )
    SELECT pg_notify(${EVENT_CHANNEL}, json_build_object('listId', ${purchase.list_id}::text, 'id', (SELECT "id" FROM inserted))::text)
  `);
}
async function lockPurchase(tx: Tx, id: string): Promise<StockPurchase | undefined> {
  const locked = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "stock_purchases" WHERE "id" = ${id}::uuid FOR UPDATE`,
  );

  return locked.length === 0
    ? undefined
    : ((await tx.stockPurchase.findUnique({ where: { id } })) ?? undefined);
}
function notOpen(code = 'PURCHASE_NOT_OPEN'): never {
  throw new ConflictException({ code, message: 'The purchase is not open' });
}
async function touch(tx: Tx, id: string): Promise<void> {
  await tx.stockPurchase.update({ data: { last_activity_at: new Date() }, where: { id } });
}

@Injectable()
export class PurchaseRepository implements IPurchaseRepository {
  constructor(private readonly db: Database) {}

  async close(
    params: ClosePurchaseParams,
    postFinance: (rows: PurchaseRowRecord[]) => Promise<FinanceReference>,
  ): Promise<ClosedPurchaseResult> {
    return this.db.runInTransaction(async () => {
      const tx = this.db.client;
      const purchase = await lockPurchase(tx, params.purchaseId);

      if (!purchase || !['ENDED', 'OPEN'].includes(purchase.status)) {
        return notOpen();
      }

      const stored = await tx.stockPurchaseRow.findMany({
        include: ROW_INCLUDE,
        where: { purchase_id: purchase.id, state: PurchaseRowState.IN_CART },
      });
      const inputs = new Map(params.rows.map((row) => [row.rowId, row]));
      const newItemIds: string[] = [];
      const entries: { itemId: string; quantity: number; row: StockPurchaseRow }[] = [];

      for (const raw of stored) {
        const input = inputs.get(raw.id);
        const quantity = input?.quantity ?? toNumber(raw.quantity) ?? 0;
        let itemId = input?.itemId ?? raw.item_id;

        // Spec 121 FR 26: a code the owner already has links the row to that item instead of a duplicate.
        const holder =
          !itemId && raw.barcode
            ? await tx.stockItem.findFirst({
                select: { id: true },
                where: {
                  barcode: raw.barcode,
                  owner: purchase.owner,
                  owner_id: purchase.owner_id,
                },
              })
            : null;

        if (holder) {
          itemId = holder.id;
        }

        if (!itemId) {
          const created = await tx.stockItem.create({
            data: {
              barcode: raw.barcode,
              category_id: input?.newItem?.categoryId,
              description: input?.newItem?.description ?? raw.description ?? '',
              location_id: input?.newItem?.locationId,
              owner: purchase.owner,
              owner_id: purchase.owner_id,
              unit: raw.unit as StockUnit,
            },
          });

          itemId = created.id;
          newItemIds.push(created.id);
        }

        const line = input?.lineTotalCents ?? raw.line_total_cents ?? undefined;
        const unitPrice =
          input?.unitPriceCents ??
          raw.unit_price_cents ??
          (line !== undefined && quantity > 0 ? unitFromLine(line, quantity) : undefined);
        const updated = await tx.stockPurchaseRow.update({
          data: {
            expiration_date: input?.expirationDate ?? raw.expiration_date,
            item_id: itemId,
            line_total_cents: line ?? null,
            quantity,
            unit_price_cents: unitPrice ?? null,
          },
          where: { id: raw.id },
        });

        entries.push({ itemId, quantity, row: updated });
      }

      // Item locks are taken in id order (spec 120 §11) before any finance lock.
      let lots = 0;

      for (const entry of [...entries].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "stock_items" WHERE "id" = ${entry.itemId} FOR UPDATE`,
        );

        const expiration = entry.row.expiration_date;
        const lot = await tx.stockLot.findFirst({
          where: {
            expiration_date: expiration,
            item_id: entry.itemId,
            opened_at: null,
          },
        });
        let lotId: string;

        if (lot) {
          lotId = lot.id;
          await tx.stockLot.update({
            data: {
              quantity: fromMilli(toMilli(Number(lot.quantity)) + toMilli(entry.quantity)),
            },
            where: { id: lot.id },
          });
        } else {
          lotId = (
            await tx.stockLot.create({
              data: {
                expiration_date: expiration,
                item_id: entry.itemId,
                purchase_date: params.date,
                quantity: entry.quantity,
              },
            })
          ).id;
          lots += 1;
        }

        const movement = await tx.stockMovement.create({
          data: {
            item_id: entry.itemId,
            lot_id: lotId,
            quantity: entry.quantity,
            reason: 'PURCHASE',
            type: 'ENTRY',
            user_id: params.userId,
          },
        });

        await tx.stockPurchaseRow.update({
          data: { entry_movement_id: movement.id },
          where: { id: entry.row.id },
        });
        await syncRestockRows(tx, [entry.itemId]);
      }

      const rows = (
        await tx.stockPurchaseRow.findMany({
          include: ROW_INCLUDE,
          where: { purchase_id: purchase.id, state: PurchaseRowState.IN_CART },
        })
      ).map(toRow);
      const reference = await postFinance(rows);

      await tx.stockPriceHistory.createMany({
        data: rows
          .filter((row) => row.itemId && row.unitPriceCents && !row.unknownPrice)
          .map((row) => ({
            currency: purchase.currency,
            date: params.date,
            item_id: row.itemId as string,
            market_id: params.marketId ?? purchase.market_id,
            purchase_id: purchase.id,
            unit_price_cents: row.unitPriceCents as number,
          })),
      });

      const { removedRows, updatedRows } = await this.updateList(tx, rows);
      const closed = await tx.stockPurchase.update({
        data: {
          account_id: params.accountId ?? null,
          closed_at: new Date(),
          closed_by: params.userId,
          closing_at: null,
          closing_by: null,
          credit_card_id: params.creditCardId ?? null,
          invoice_month: params.invoiceMonth ?? null,
          market_id: params.marketId ?? purchase.market_id,
          purchase_date: params.date,
          receipt_total_cents: params.receiptTotalCents,
          split_id: reference.splitId ?? null,
          status: StockPurchaseStatus.CLOSED,
          transaction_id: reference.transactionId ?? null,
        },
        where: { id: purchase.id },
      });

      await this.linkFinance(tx, purchase.id, reference);

      await emit(
        tx,
        purchase,
        'purchase.closed',
        { id: purchase.id },
        params.userId,
        params.clientId,
      );

      return { lots, newItemIds, purchase: toPurchase(closed), removedRows, updatedRows };
    });
  }

  async create(params: Parameters<IPurchaseRepository['create']>[0]) {
    return this.db.client.$transaction(async (tx) => {
      const existing = await tx.stockPurchase.findUnique({ where: { id: params.id } });

      if (existing) {
        if (existing.started_by !== params.userId) {
          throw new ConflictException('The purchase id is already in use');
        }

        return { created: false, purchase: toPurchase(existing) };
      }

      const created = await tx.stockPurchase.create({
        data: {
          currency: params.currency,
          id: params.id,
          list_id: params.listId,
          market_id: params.marketId,
          owner: params.owner as OwnerType,
          owner_id: params.ownerId,
          purchase_date: params.purchaseDate,
          started_by: params.userId,
        },
      });

      await emit(tx, created, 'purchase.created', { id: created.id }, params.userId);

      return { created: true, purchase: toPurchase(created) };
    });
  }

  async deleteByOwner(access: OwnerAccess): Promise<void> {
    const key = { owner: access.owner as OwnerType, owner_id: access.ownerId };

    await this.db.client.$transaction(async (tx) => {
      const purchases = await tx.stockPurchase.findMany({ select: { id: true }, where: key });
      const ids = purchases.map((purchase) => purchase.id);

      await tx.stockPurchaseEvent.deleteMany({ where: { purchase_id: { in: ids } } });
      await tx.stockPurchase.deleteMany({ where: key });
    });
  }

  async deleteClosed(
    purchaseId: string,
    userId: string,
    cancelFinance: (reference: FinanceReference) => Promise<void>,
  ): Promise<{ kept: PurchaseRowRecord[] }> {
    return this.db.runInTransaction(async () => {
      const tx = this.db.client;
      const purchase = await lockPurchase(tx, purchaseId);

      if (!purchase || purchase.status !== StockPurchaseStatus.CLOSED) {
        return notOpen('PURCHASE_NOT_CLOSED');
      }

      const rows = await tx.stockPurchaseRow.findMany({
        include: ROW_INCLUDE,
        where: { purchase_id: purchaseId, state: PurchaseRowState.IN_CART },
      });
      const used = new Set(await this.findUsedRowIds(purchaseId));
      const kept: PurchaseRowRecord[] = [];
      const itemIds = new Set<string>();

      for (const row of rows) {
        if (used.has(row.id)) {
          kept.push(toRow(row));
        } else if (row.entry_movement_id) {
          const movement = await tx.stockMovement.findUnique({
            where: { id: row.entry_movement_id },
          });

          if (movement) {
            const lot = await tx.stockLot.findUniqueOrThrow({ where: { id: movement.lot_id } });
            const left = toMilli(Number(lot.quantity)) - toMilli(Number(movement.quantity));

            await tx.stockMovement.delete({ where: { id: movement.id } });
            if (left <= 0) {
              await tx.stockLot.delete({ where: { id: lot.id } });
            } else {
              await tx.stockLot.update({
                data: { quantity: fromMilli(left) },
                where: { id: lot.id },
              });
            }
            itemIds.add(movement.item_id);
          }
        }
      }

      await syncRestockRows(tx, [...itemIds], { clearDismissal: false });
      await cancelFinance({
        splitId: purchase.split_id ?? undefined,
        transactionId: purchase.transaction_id ?? undefined,
      });
      await emit(tx, purchase, 'purchase.discarded', { id: purchaseId }, userId);
      await tx.stockPurchase.delete({ where: { id: purchaseId } });

      return { kept };
    });
  }

  async deleteRow(params: {
    clientId?: string;
    purchaseId: string;
    rowId: string;
    userId: string;
  }): Promise<boolean> {
    return this.db.client.$transaction(async (tx) => {
      const purchase = await lockPurchase(tx, params.purchaseId);

      if (!purchase || purchase.status !== StockPurchaseStatus.OPEN) {
        return notOpen();
      }

      const removed = await tx.stockPurchaseRow.deleteMany({
        where: { id: params.rowId, purchase_id: params.purchaseId },
      });

      if (removed.count === 0) {
        return false;
      }

      await touch(tx, purchase.id);
      await emit(tx, purchase, 'row.removed', { id: params.rowId }, params.userId, params.clientId);

      return true;
    });
  }

  async discardIdle(owners: OwnerAccess[], before: Date): Promise<number> {
    if (owners.length === 0) {
      return 0;
    }

    const result = await this.db.client.stockPurchase.updateMany({
      data: { status: StockPurchaseStatus.DISCARDED },
      where: {
        ...toOwnerWhere(owners),
        last_activity_at: { lt: before },
        rows: { none: { state: PurchaseRowState.IN_CART } },
        status: StockPurchaseStatus.OPEN,
      },
    });

    return result.count;
  }

  async findById(id: string): Promise<PurchaseEntity | undefined> {
    const raw = await this.db.client.stockPurchase.findUnique({ where: { id } });

    return raw ? toPurchase(raw) : undefined;
  }

  async findByList(listId: string, statuses: PurchaseStatuses[]): Promise<PurchaseEntity[]> {
    const raw = await this.db.client.stockPurchase.findMany({
      orderBy: [{ started_at: 'asc' }, { id: 'asc' }],
      where: { list_id: listId, status: { in: statuses as StockPurchaseStatus[] } },
    });

    return raw.map(toPurchase);
  }

  async findClosedByList(
    listId: string,
    limit: number,
    cursor?: { closedAt: Date; id: string },
  ): Promise<PurchaseEntity[]> {
    const raw = await this.db.client.stockPurchase.findMany({
      orderBy: [{ closed_at: 'desc' }, { id: 'desc' }],
      take: limit,
      where: {
        list_id: listId,
        status: StockPurchaseStatus.CLOSED,
        ...(cursor
          ? {
              OR: [
                { closed_at: { lt: cursor.closedAt } },
                { closed_at: cursor.closedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
    });

    return raw.map(toPurchase);
  }

  async findEventsAfter(
    listId: string,
    afterId: bigint,
    limit: number,
  ): Promise<PurchaseEventRecord[]> {
    const raw = await this.db.client.stockPurchaseEvent.findMany({
      orderBy: { id: 'asc' },
      take: limit,
      where: { id: { gt: afterId }, list_id: listId },
    });

    return raw.map((event) => ({
      id: event.id,
      payload: event.payload,
      purchaseId: event.purchase_id,
      type: event.type,
    }));
  }

  async findLastPrices(itemIds: string[], marketId: string): Promise<Map<string, LastPrice>> {
    if (itemIds.length === 0) {
      return new Map();
    }

    const raw = await this.db.client.stockPriceHistory.findMany({
      distinct: ['item_id'],
      orderBy: [{ item_id: 'asc' }, { date: 'desc' }, { created_at: 'desc' }],
      select: { date: true, item_id: true, unit_price_cents: true },
      where: { item_id: { in: itemIds }, market_id: marketId },
    });

    return new Map(
      raw.map((price) => [
        price.item_id,
        { date: price.date, unitPriceCents: price.unit_price_cents },
      ]),
    );
  }

  async findOtherCarts(listId: string, excludePurchaseId: string): Promise<OtherCart[]> {
    const raw = await this.db.client.stockPurchaseRow.findMany({
      include: {
        checker: { select: { name: true } },
        purchase: { include: { market: { select: { name: true } } } },
      },
      where: {
        list_row_id: { not: null },
        purchase: {
          id: { not: excludePurchaseId },
          list_id: listId,
          status: { in: [StockPurchaseStatus.OPEN, StockPurchaseStatus.ENDED] },
        },
        state: PurchaseRowState.IN_CART,
      },
    });

    return raw.map((row) => ({
      listRowId: row.list_row_id as string,
      marketName: row.purchase.market.name,
      purchaseId: row.purchase_id,
      userName: row.checker?.name ?? '',
    }));
  }

  async findPending(owners: OwnerAccess[], now: Date): Promise<PendingPurchase[]> {
    if (owners.length === 0) {
      return [];
    }

    const idleBefore = new Date(now.getTime() - FORGOTTEN_AFTER_MS);
    const raw = await this.db.client.stockPurchase.findMany({
      include: {
        list: { select: { name: true } },
        market: { select: { name: true } },
        rows: { select: { line_total_cents: true, state: true } },
      },
      orderBy: [{ last_activity_at: 'asc' }, { id: 'asc' }],
      where: {
        ...toOwnerWhere(owners),
        OR: [
          { status: StockPurchaseStatus.ENDED },
          { last_activity_at: { lt: idleBefore }, status: StockPurchaseStatus.OPEN },
        ],
      },
    });

    return raw.map((purchase) => {
      const inCart = purchase.rows.filter((row) => row.state === PurchaseRowState.IN_CART);

      return {
        cartTotalCents: inCart.reduce((sum, row) => sum + (row.line_total_cents ?? 0), 0),
        checkedCount: inCart.length,
        id: purchase.id,
        lastActivityAt: purchase.last_activity_at,
        listId: purchase.list_id,
        listName: purchase.list.name,
        marketName: purchase.market.name,
        status: PurchaseStatuses[purchase.status],
      };
    });
  }

  async findPriceHistory(
    itemId: string,
    limit: number,
    marketId?: string,
    cursor?: { date: Date; id: string },
  ): Promise<PriceHistoryPoint[]> {
    const since = new Date();

    since.setUTCMonth(since.getUTCMonth() - 24);

    const raw = await this.db.client.stockPriceHistory.findMany({
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit,
      where: {
        date: { gte: since },
        item_id: itemId,
        ...(marketId ? { market_id: marketId } : {}),
        ...(cursor
          ? { OR: [{ date: { lt: cursor.date } }, { date: cursor.date, id: { lt: cursor.id } }] }
          : {}),
      },
    });

    return raw.map((point) => ({
      date: point.date,
      id: point.id,
      marketId: point.market_id,
      unitPriceCents: point.unit_price_cents,
    }));
  }

  async findRows(purchaseIds: string[]): Promise<PurchaseRowRecord[]> {
    if (purchaseIds.length === 0) {
      return [];
    }

    const raw = await this.db.client.stockPurchaseRow.findMany({
      include: ROW_INCLUDE,
      orderBy: [{ checked_at: 'asc' }, { id: 'asc' }],
      where: { purchase_id: { in: purchaseIds } },
    });

    return raw.map(toRow);
  }

  // FR 39/41: a row is used when its lot got a movement after the row's entry.
  async findUsedRowIds(purchaseId: string): Promise<string[]> {
    const rows = await this.db.client.stockPurchaseRow.findMany({
      select: {
        entry_movement: { select: { created_at: true, id: true, lot_id: true } },
        id: true,
      },
      where: { entry_movement_id: { not: null }, purchase_id: purchaseId },
    });
    const used: string[] = [];

    for (const row of rows) {
      const entry = row.entry_movement;

      if (
        entry &&
        (await this.db.client.stockMovement.count({
          where: {
            created_at: { gt: entry.created_at },
            id: { not: entry.id },
            lot_id: entry.lot_id,
          },
        })) > 0
      ) {
        used.push(row.id);
      }
    }

    return used;
  }

  async mergeInto(sourceId: string, targetId: string, userId: string): Promise<PurchaseEntity> {
    return this.db.client.$transaction(async (tx) => {
      const [first, second] = [sourceId, targetId].sort();

      await lockPurchase(tx, first);
      await lockPurchase(tx, second);

      const source = await tx.stockPurchase.findUniqueOrThrow({ where: { id: sourceId } });
      const target = await tx.stockPurchase.findUniqueOrThrow({ where: { id: targetId } });
      const targetRows = await tx.stockPurchaseRow.findMany({ where: { purchase_id: targetId } });
      const sourceRows = await tx.stockPurchaseRow.findMany({ where: { purchase_id: sourceId } });

      for (const row of sourceRows) {
        const twin = targetRows.find(
          (other) =>
            (row.item_id !== null && other.item_id === row.item_id) ||
            (row.list_row_id !== null && other.list_row_id === row.list_row_id),
        );

        if (twin) {
          await tx.stockPurchaseRow.update({
            data: {
              quantity:
                twin.quantity === null || row.quantity === null
                  ? (twin.quantity ?? row.quantity)
                  : fromMilli(toMilli(Number(twin.quantity)) + toMilli(Number(row.quantity))),
            },
            where: { id: twin.id },
          });
          await tx.stockPurchaseRow.delete({ where: { id: row.id } });
        } else {
          await tx.stockPurchaseRow.update({
            data: { purchase_id: targetId },
            where: { id: row.id },
          });
        }
      }

      await tx.stockPurchase.update({
        data: { ended_at: null, status: StockPurchaseStatus.DISCARDED },
        where: { id: source.id },
      });
      const merged = await tx.stockPurchase.update({
        data: { last_activity_at: new Date() },
        where: { id: target.id },
      });

      await emit(tx, source, 'purchase.merged', { into: targetId }, userId);

      return toPurchase(merged);
    });
  }

  async setClosing(id: string, userId: null | string, now: Date): Promise<PurchaseEntity> {
    const updated = await this.db.client.stockPurchase.update({
      data: { closing_at: userId ? now : null, closing_by: userId },
      where: { id },
    });

    return toPurchase(updated);
  }

  async transition(
    id: string,
    to: PurchaseStatuses,
    userId: string,
    clientId?: string,
  ): Promise<PurchaseEntity> {
    return this.db.client.$transaction(async (tx) => {
      const purchase = await lockPurchase(tx, id);

      if (!purchase) {
        return notOpen();
      }

      const updated = await tx.stockPurchase.update({
        data: {
          ended_at: to === PurchaseStatuses.ENDED ? new Date() : null,
          last_activity_at: new Date(),
          status: to as StockPurchaseStatus,
        },
        where: { id },
      });
      const type = {
        [PurchaseStatuses.CLOSED]: 'purchase.closed',
        [PurchaseStatuses.DISCARDED]: 'purchase.discarded',
        [PurchaseStatuses.ENDED]: 'purchase.ended',
        [PurchaseStatuses.OPEN]: 'purchase.reopened',
      }[to];

      await emit(tx, purchase, type, { id, status: to }, userId, clientId);

      return toPurchase(updated);
    });
  }

  async updateClosed(
    params: Parameters<IPurchaseRepository['updateClosed']>[0],
    repostFinance: (rows: PurchaseRowRecord[]) => Promise<FinanceReference>,
  ): Promise<PurchaseWithRows> {
    return this.db.runInTransaction(async () => {
      const tx = this.db.client;
      const purchase = await lockPurchase(tx, params.purchaseId);

      if (!purchase || purchase.status !== StockPurchaseStatus.CLOSED) {
        return notOpen('PURCHASE_NOT_CLOSED');
      }

      for (const price of params.rowPrices ?? []) {
        await tx.stockPurchaseRow.updateMany({
          data: {
            line_total_cents: price.lineTotalCents ?? null,
            unit_price_cents: price.unitPriceCents ?? null,
          },
          where: { id: price.rowId, purchase_id: purchase.id },
        });
      }

      const rows = (
        await tx.stockPurchaseRow.findMany({
          include: ROW_INCLUDE,
          where: { purchase_id: purchase.id, state: PurchaseRowState.IN_CART },
        })
      ).map(toRow);

      const reference = await repostFinance(rows);

      const updated = await tx.stockPurchase.update({
        data: {
          account_id: params.accountId,
          credit_card_id: params.creditCardId,
          invoice_month: params.invoiceMonth,
          market_id: params.marketId,
          purchase_date: params.date,
          receipt_total_cents: params.receiptTotalCents,
          split_id: reference.splitId ?? null,
          transaction_id: reference.transactionId ?? null,
        },
        where: { id: purchase.id },
      });

      await this.linkFinance(tx, purchase.id, reference);

      // FR 39: the price history of the purchase is rewritten.
      await tx.stockPriceHistory.deleteMany({ where: { purchase_id: purchase.id } });
      await tx.stockPriceHistory.createMany({
        data: rows
          .filter((row) => row.itemId && row.unitPriceCents && !row.unknownPrice)
          .map((row) => ({
            currency: updated.currency,
            date: updated.purchase_date,
            item_id: row.itemId as string,
            market_id: updated.market_id,
            purchase_id: purchase.id,
            unit_price_cents: row.unitPriceCents as number,
          })),
      });

      return { purchase: toPurchase(updated), rows };
    });
  }

  async upsertRow(params: UpsertPurchaseRowParams): Promise<UpsertPurchaseRowResult> {
    return this.db.client.$transaction(async (tx) => {
      const purchase = await lockPurchase(tx, params.purchaseId);

      if (!purchase || purchase.status !== StockPurchaseStatus.OPEN) {
        return notOpen();
      }

      if (params.clientId) {
        const seen = await tx.stockPurchaseEvent.findUnique({
          where: { client_id: params.clientId },
        });

        if (seen) {
          const stored = await tx.stockPurchaseRow.findUniqueOrThrow({
            include: ROW_INCLUDE,
            where: { id: params.rowId },
          });

          return { convertedToOutside: false, row: toRow(stored) };
        }
      }

      const existing = await tx.stockPurchaseRow.findUnique({ where: { id: params.rowId } });
      let { description, itemId, listRowId, unit } = params;
      let conflict: UpsertPurchaseRowResult['conflict'];

      // FR 18: a list row already checked in another purchase of the list keeps its first owner.
      if (listRowId && (!existing || existing.list_row_id !== listRowId)) {
        const taken = await tx.stockPurchaseRow.findFirst({
          include: { checker: { select: { name: true } } },
          where: {
            list_row_id: listRowId,
            purchase: {
              id: { not: purchase.id },
              list_id: purchase.list_id,
              status: { in: [StockPurchaseStatus.OPEN, StockPurchaseStatus.ENDED] },
            },
            state: PurchaseRowState.IN_CART,
          },
        });

        if (taken) {
          const listRow = await tx.stockShoppingListRow.findUnique({ where: { id: listRowId } });

          conflict = { purchaseId: taken.purchase_id, userName: taken.checker?.name ?? '' };
          itemId = itemId ?? listRow?.item_id ?? undefined;
          description = description ?? listRow?.description ?? undefined;
          unit = unit ?? (listRow?.unit as StockUnits | undefined);
          listRowId = undefined;
        }
      }

      // A new row of a list row carries what the list row is: its item, or its text and unit.
      if (listRowId && !existing) {
        const source = await tx.stockShoppingListRow.findUnique({ where: { id: listRowId } });

        itemId = itemId ?? source?.item_id ?? undefined;
        description = description ?? source?.description ?? undefined;
        unit = unit ?? (source?.unit as StockUnits | undefined);
      }

      // One purchase row per item: another row with the same item takes the quantity.
      if (itemId && !existing) {
        const twin = await tx.stockPurchaseRow.findFirst({
          where: { id: { not: params.rowId }, item_id: itemId, purchase_id: purchase.id },
        });

        if (twin) {
          const summed =
            params.quantity === undefined || params.quantity === null || twin.quantity === null
              ? (params.quantity ?? toNumber(twin.quantity))
              : fromMilli(toMilli(Number(twin.quantity)) + toMilli(params.quantity));
          const merged = await tx.stockPurchaseRow.update({
            data: { quantity: summed },
            include: ROW_INCLUDE,
            where: { id: twin.id },
          });

          await touch(tx, purchase.id);
          await emit(tx, purchase, 'row.upserted', toRow(merged), params.userId, params.clientId);

          return { conflict, convertedToOutside: conflict !== undefined, row: toRow(merged) };
        }
      }

      const fields = {
        expiration_date: params.expirationDate,
        line_total_cents: params.lineTotalCents,
        price_input: params.priceInput,
        quantity: params.quantity,
        state: params.state as PurchaseRowState | undefined,
        unit_price_cents: params.unitPriceCents,
      };
      const saved = existing
        ? await tx.stockPurchaseRow.update({
            data: { ...fields, unknown_price: false },
            include: ROW_INCLUDE,
            where: { id: params.rowId },
          })
        : await tx.stockPurchaseRow.create({
            data: {
              ...fields,
              barcode: params.barcode,
              checked_by: params.userId,
              description,
              id: params.rowId,
              item_id: itemId,
              list_row_id: listRowId,
              purchase_id: purchase.id,
              unit: unit as StockUnit | undefined,
            },
            include: ROW_INCLUDE,
          });

      await touch(tx, purchase.id);
      await emit(tx, purchase, 'row.upserted', toRow(saved), params.userId, params.clientId);

      return { conflict, convertedToOutside: conflict !== undefined, row: toRow(saved) };
    });
  }

  // The finance rows point back to the purchase (read-only in finance, FR 40).
  private async linkFinance(
    tx: Tx,
    purchaseId: string,
    reference: FinanceReference,
  ): Promise<void> {
    if (reference.splitId) {
      await tx.financialSplit.update({
        data: { stock_purchase_id: purchaseId },
        where: { id: reference.splitId },
      });
    }
    if (reference.transactionId) {
      await tx.financialTransaction.update({
        data: { stock_purchase_id: purchaseId },
        where: { id: reference.transactionId },
      });
    }
  }

  // FR 38: AUTO rows follow the new stock (already recomputed by the sync); manual rows are reduced or removed.
  private async updateList(
    tx: Tx,
    rows: PurchaseRowRecord[],
  ): Promise<{ removedRows: number; updatedRows: number }> {
    let removedRows = 0;
    let updatedRows = 0;

    for (const row of rows.filter((item) => item.listRowId)) {
      const listRow = await tx.stockShoppingListRow.findUnique({
        where: { id: row.listRowId as string },
      });

      if (!listRow) {
        continue;
      }

      if (!listRow.item_id) {
        await tx.stockShoppingListRow.delete({ where: { id: listRow.id } });
        removedRows += 1;
      } else if (listRow.origin !== 'AUTO') {
        const left = toMilli(Number(listRow.quantity)) - toMilli(row.quantity ?? 0);

        if (left <= 0) {
          await tx.stockShoppingListRow.delete({ where: { id: listRow.id } });
          removedRows += 1;
        } else {
          await tx.stockShoppingListRow.update({
            data: { quantity: fromMilli(left) },
            where: { id: listRow.id },
          });
          updatedRows += 1;
        }
      }
    }

    return { removedRows, updatedRows };
  }
}

export { CLOSING_LOCK_MS };
