import { Injectable } from '@nestjs/common';

import {
  ActivityBatchAggregate,
  IActivityDatasource,
} from '@activity/data/repository/datasource/IActivityDatasource';
import { ActivityEntry, ActivityEntryItem, Prisma } from '@db/client';
import { Database } from '@shared/infra/db/Database';

// Spec 127 section 11: batch items go in chunks of 500 (like 086).
export const ITEM_CHUNK = 500;

interface Delegate {
  findMany(args: {
    select: Record<string, true>;
    where: Record<string, { in: string[] }>;
  }): Promise<Record<string, string>[]>;
}
interface EntityLookup {
  idField: 'asset_id' | 'id';
  model: string;
}

function tx(model: string): EntityLookup {
  return { idField: 'id', model };
}

// Entity type -> the table whose row "still exists" (FR 10). TRANSACTION_IMPORT has no single item.
export const ENTITY_LOOKUP: Record<ActivityEntry['entity_type'], EntityLookup | null> = {
  ACCOUNT: tx('financialAccount'),
  ASSET: tx('investmentAsset'),
  BALANCE_ADJUSTMENT: tx('financialTransaction'),
  CARD_EARLY_PAYMENT: tx('financialTransaction'),
  CARD_REFUND: tx('financialTransaction'),
  CATEGORY: tx('financialCategory'),
  CONVERSION: tx('investmentConversion'),
  CORPORATE_EVENT: tx('investmentCorporateEvent'),
  CREDIT_CARD: tx('financialCreditCard'),
  FIXED_INCOME_TERMS: { idField: 'asset_id', model: 'investmentFixedIncomeTerms' },
  INCOME: tx('investmentIncome'),
  INCOME_SERIES: tx('investmentIncomeSeries'),
  INSTALLMENT_PLAN: tx('financialInstallmentPlan'),
  INSTALLMENT_PREPAYMENT: tx('financialInstallmentPrepayment'),
  INVOICE_PAYMENT: tx('financialInvoicePayment'),
  OPERATION: tx('investmentOperation'),
  RECURRENCE: tx('financialRecurrence'),
  SPLIT: tx('financialSplit'),
  STOCK_PURCHASE_POSTING: tx('stockPurchase'),
  TAG: tx('financialTag'),
  TRANSACTION: tx('financialTransaction'),
  TRANSACTION_IMPORT: null,
  TRANSFER: tx('financialTransfer'),
  VALUATION: tx('investmentValuation'),
};

@Injectable()
export class ActivityDatasource implements IActivityDatasource {
  constructor(private readonly db: Database) {}

  async aggregateItems(entryId: string): Promise<ActivityBatchAggregate> {
    const where = { entry_id: entryId };
    const [totals, range, sources, count] = await Promise.all([
      this.db.client.activityEntryItem.groupBy({
        _sum: { amount_cents: true },
        by: ['currency'],
        where: { ...where, amount_cents: { not: null }, currency: { not: null } },
      }),
      this.db.client.activityEntryItem.aggregate({
        _max: { booking_date: true },
        _min: { booking_date: true },
        where,
      }),
      this.db.client.activityEntryItem.findMany({
        distinct: ['source_name'],
        select: { source_name: true },
        take: 20,
        where: { ...where, source_name: { not: null } },
      }),
      this.db.client.activityEntryItem.count({ where }),
    ]);

    return {
      bookingFrom: range._min.booking_date,
      bookingTo: range._max.booking_date,
      count,
      sources: sources.map((row) => row.source_name as string),
      totals: totals.map((row) => ({
        amount: row._sum.amount_cents ?? BigInt(0),
        currency: row.currency as string,
      })),
    };
  }

  async deleteByOwner(owner: ActivityEntry['owner'], ownerId: string): Promise<number> {
    const result = await this.db.client.activityEntry.deleteMany({
      where: { owner, owner_id: ownerId },
    });

    return result.count;
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db.client.activityEntry.deleteMany({
      where: { occurred_at: { lt: cutoff } },
    });

    return result.count;
  }

  async existing(refs: Map<ActivityEntry['entity_type'], string[]>): Promise<Set<string>> {
    const found = new Set<string>();

    await Promise.all(
      [...refs.entries()].map(async ([type, ids]) => {
        const lookup = ENTITY_LOOKUP[type];

        if (!lookup || ids.length === 0) {
          return;
        }

        const delegate = (this.db.client as unknown as Record<string, Delegate>)[lookup.model];
        const rows = await delegate.findMany({
          select: { [lookup.idField]: true },
          where: { [lookup.idField]: { in: [...new Set(ids)] } },
        });

        rows.forEach((row) => found.add(`${type}:${row[lookup.idField]}`));
      }),
    );

    return found;
  }

  async findEntry(
    id: string,
    owners: Prisma.ActivityEntryWhereInput[],
  ): Promise<ActivityEntry | null> {
    return this.db.client.activityEntry.findFirst({ where: { id, OR: owners } });
  }

  async findItemRefs(
    entryId: string,
  ): Promise<Pick<ActivityEntryItem, 'entity_id' | 'entity_type'>[]> {
    return this.db.client.activityEntryItem.findMany({
      select: { entity_id: true, entity_type: true },
      where: { entry_id: entryId },
    });
  }

  async findItems(
    where: Prisma.ActivityEntryItemWhereInput,
    take: number,
  ): Promise<ActivityEntryItem[]> {
    return this.db.client.activityEntryItem.findMany({
      orderBy: [{ booking_date: { nulls: 'last', sort: 'desc' } }, { id: 'desc' }],
      take,
      where,
    });
  }

  async findPage(where: Prisma.ActivityEntryWhereInput, take: number): Promise<ActivityEntry[]> {
    return this.db.client.activityEntry.findMany({
      orderBy: [{ occurred_at: 'desc' }, { id: 'desc' }],
      take,
      where,
    });
  }

  // Joins the ambient transaction of the request (`Database.client`), so a rolled back write leaves no entry.
  async insert(
    entry: Prisma.ActivityEntryUncheckedCreateInput,
    items: Prisma.ActivityEntryItemCreateManyInput[],
  ): Promise<void> {
    const created = await this.db.client.activityEntry.create({
      data: entry,
      select: { id: true },
    });

    for (let start = 0; start < items.length; start += ITEM_CHUNK) {
      await this.db.client.activityEntryItem.createMany({
        data: items.slice(start, start + ITEM_CHUNK).map((item) => ({
          ...item,
          entry_id: created.id,
        })),
      });
    }
  }
}
