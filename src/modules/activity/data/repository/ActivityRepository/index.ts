import { Inject, Injectable } from '@nestjs/common';

import {
  ActivityEntryRow,
  ActivityItemRow,
  IActivityDatasource,
} from '@activity/data/repository/datasource/IActivityDatasource';
import {
  ActivityEntryEntity,
  ActivityItemEntity,
  ActivityListFilter,
  ActivityPage,
  ActivitySummary,
  BatchItemsPage,
  BatchItemsQuery,
  EntityRefs,
  NewActivityEntry,
} from '@activity/domain/entity/ActivityEntry';
import {
  ActivityAction,
  ActivityActionFilter,
  ActivityEntityType,
  ActivityModule,
} from '@activity/domain/enum';
import { IActivityRepository } from '@activity/domain/repository/IActivityRepository';
import { ActivityChange } from '@activity/domain/service/ActivityDiff';
import { toActivityTerms } from '@activity/domain/service/ActivitySearchText';
import { Prisma } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

type OwnerRef = { ownerId: string; ownerType: OwnerType };

function actionWhere(action: ActivityActionFilter | undefined): Prisma.ActivityEntryWhereInput {
  if (action === undefined) {
    return {};
  }

  return action === ActivityActionFilter.BATCH ? { batch: true } : { action };
}
function day(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}
function ownerWhere(owners: OwnerRef[]): Prisma.ActivityEntryWhereInput[] {
  return owners.map((owner) => ({ owner: owner.ownerType, owner_id: owner.ownerId }));
}
function searchClauses(q: string | undefined): Prisma.ActivityEntryWhereInput[] {
  if (!q || q.trim() === '') {
    return [];
  }

  const terms = toActivityTerms(q);
  const options: Prisma.ActivityEntryWhereInput[] = [{ search_text: { contains: terms.text } }];

  if (terms.amount !== null) {
    options.push({ search_text: { contains: terms.amount } });
  }

  return [{ OR: options }];
}
function toEntry(row: ActivityEntryRow): ActivityEntryEntity {
  const summary = row.summary as unknown as ActivitySummary;
  const extra = summary.extra as { itemCount?: number; previewLabels?: string[] } | undefined;

  return {
    action: row.action as ActivityAction,
    actorId: row.actor_id,
    actorName: row.actor_name,
    batch: row.batch,
    batchPreview: row.batch
      ? { count: extra?.itemCount ?? 0, labels: extra?.previewLabels ?? [] }
      : null,
    changes: (row.changes as unknown as ActivityChange[] | null) ?? null,
    entityId: row.entity_id,
    entityType: row.entity_type as ActivityEntityType,
    id: row.id,
    modules: row.modules as ActivityModule[],
    occurredAt: row.occurred_at,
    ownerId: row.owner_id,
    ownerType: row.owner as OwnerType,
    searchText: row.search_text,
    summary,
  };
}
function toItem(row: ActivityItemRow): ActivityItemEntity {
  return {
    action: row.action as ActivityAction,
    amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
    bookingDate: row.booking_date ? row.booking_date.toISOString().slice(0, 10) : null,
    currency: row.currency,
    entityId: row.entity_id,
    entityType: row.entity_type as ActivityEntityType,
    id: row.id,
    label: row.label,
    sourceName: row.source_name,
  };
}

@Injectable()
export class ActivityRepository implements IActivityRepository {
  constructor(@Inject('IActivityDatasource') private readonly datasource: IActivityDatasource) {}

  async deleteByOwner(owner: OwnerType, ownerId: string): Promise<number> {
    return this.datasource.deleteByOwner(owner, ownerId);
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    return this.datasource.deleteOlderThan(cutoff);
  }

  async existingRefs(refs: EntityRefs): Promise<Set<string>> {
    return this.datasource.existing(refs);
  }

  async findEntry(id: string, owners: OwnerRef[]): Promise<ActivityEntryEntity | null> {
    if (owners.length === 0) {
      return null;
    }

    const row = await this.datasource.findEntry(id, ownerWhere(owners));

    return row ? toEntry(row) : null;
  }

  async insert(entry: NewActivityEntry): Promise<void> {
    await this.datasource.insert(
      {
        action: entry.action,
        actor_id: entry.actorId,
        actor_name: entry.actorName,
        batch: entry.batch,
        changes: (entry.changes ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
        entity_id: entry.entityId,
        entity_type: entry.entityType,
        modules: entry.modules,
        occurred_at: entry.occurredAt,
        owner: entry.ownerType,
        owner_id: entry.ownerId,
        search_text: entry.searchText,
        summary: entry.summary as unknown as Prisma.InputJsonValue,
      },
      entry.items.map((item) => ({
        action: item.action,
        amount_cents:
          item.amountCents === null || item.amountCents === undefined
            ? null
            : BigInt(item.amountCents),
        booking_date: item.bookingDate ? new Date(`${item.bookingDate}T00:00:00.000Z`) : null,
        currency: item.currency ?? null,
        entity_id: item.entityId,
        entity_type: item.entityType,
        entry_id: '',
        label: item.label,
        source_name: item.sourceName ?? null,
      })),
    );
  }

  async list(filter: ActivityListFilter, pageSize: number): Promise<ActivityPage> {
    const and: Prisma.ActivityEntryWhereInput[] = [
      { OR: ownerWhere(filter.owners) },
      ...searchClauses(filter.q),
    ];

    if (filter.cursor) {
      and.push({
        OR: [
          { occurred_at: { lt: filter.cursor.occurredAt } },
          { id: { lt: filter.cursor.id }, occurred_at: filter.cursor.occurredAt },
        ],
      });
    }

    const where: Prisma.ActivityEntryWhereInput = {
      AND: and,
      modules: { has: filter.module },
      occurred_at: { gte: filter.from, lte: filter.to },
      ...(filter.actorId ? { actor_id: filter.actorId } : {}),
      ...actionWhere(filter.action),
    };
    const rows = await this.datasource.findPage(where, pageSize + 1);

    return { hasMore: rows.length > pageSize, rows: rows.slice(0, pageSize).map(toEntry) };
  }

  async listItemRefs(
    entryId: string,
  ): Promise<{ entityId: string; entityType: ActivityEntityType }[]> {
    const rows = await this.datasource.findItemRefs(entryId);

    return rows.map((row) => ({
      entityId: row.entity_id,
      entityType: row.entity_type as ActivityEntityType,
    }));
  }

  async listItems(
    query: BatchItemsQuery,
    pageSize: number,
    withHeader: boolean,
  ): Promise<BatchItemsPage> {
    const and: Prisma.ActivityEntryItemWhereInput[] = [];

    if (query.q && query.q.trim() !== '') {
      const terms = toActivityTerms(query.q);

      and.push({
        OR: [
          { label: { contains: query.q.trim(), mode: 'insensitive' } },
          { source_name: { contains: query.q.trim(), mode: 'insensitive' } },
          ...(terms.amount === null ? [] : [{ amount_cents: { in: amountCentsOf(terms.amount) } }]),
        ],
      });
    }

    if (query.cursor) {
      const { bookingDate, id } = query.cursor;

      and.push(
        bookingDate === null
          ? { booking_date: null, id: { lt: id } }
          : {
              OR: [
                { booking_date: { lt: new Date(`${bookingDate}T00:00:00.000Z`) } },
                { booking_date: null },
                { booking_date: new Date(`${bookingDate}T00:00:00.000Z`), id: { lt: id } },
              ],
            },
      );
    }

    const rows = await this.datasource.findItems(
      { AND: and, entry_id: query.entryId },
      pageSize + 1,
    );
    const header = withHeader ? await this.datasource.aggregateItems(query.entryId) : null;

    return {
      hasMore: rows.length > pageSize,
      header: header && {
        bookingFrom: day(header.bookingFrom),
        bookingTo: day(header.bookingTo),
        count: header.count,
        sources: header.sources,
        totals: header.totals.map((total) => ({
          amountCents: Number(total.amount),
          currency: total.currency,
        })),
      },
      items: rows.slice(0, pageSize).map(toItem),
    };
  }
}

// "1200,00" / "1200" -> the cents it can mean, in both signs (amounts are stored signed).
function amountCentsOf(amount: string): bigint[] {
  const [units, decimals] = amount.split(',');
  const cents = BigInt(units) * BigInt(100) + BigInt(decimals ?? '0');

  return [cents, -cents];
}
