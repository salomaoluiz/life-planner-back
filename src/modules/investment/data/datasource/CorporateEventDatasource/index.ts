import { Injectable } from '@nestjs/common';

import { InvestmentCorporateEvent, Prisma } from '@db/client';
import {
  InvestmentMapper,
  POSITION_SELECT,
} from '@investment/data/datasource/mapper/InvestmentMapper';
import {
  EventSuggestionInputsRow,
  EventSuggestionRow,
  ICorporateEventDatasource,
} from '@investment/data/repository/datasource/ICorporateEventDatasource';
import { CorporateEventUpsert } from '@investment/domain/entity/CorporateEventEntity';
import { Database } from '@shared/infra/db/Database';

@Injectable()
export class CorporateEventDatasource implements ICorporateEventDatasource {
  constructor(private readonly db: Database) {}

  async countPendingByAsset(assetIds: string[]): Promise<{ asset_id: string; count: number }[]> {
    if (assetIds.length === 0) {
      return [];
    }

    const rows = await this.db.client.investmentEventSuggestion.groupBy({
      _count: { _all: true },
      by: ['asset_id'],
      where: { asset_id: { in: assetIds }, status: 'PENDING' },
    });

    return rows.map((row) => ({ asset_id: row.asset_id, count: row._count._all }));
  }

  async createSuggestions(
    rows: { asset_id: string; event_id: string; quantity: string }[],
  ): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const result = await this.db.client.investmentEventSuggestion.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return result.count;
  }

  async findEvents(
    keys: { market: string; ticker: string }[],
    sinceRecordDate: Date,
  ): Promise<InvestmentCorporateEvent[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.db.client.investmentCorporateEvent.findMany({
      orderBy: [{ record_date: 'asc' }, { id: 'asc' }],
      where: {
        OR: keys.map((key) => ({ market: key.market as 'B3' | 'US', ticker: key.ticker })),
        record_date: { gte: sinceRecordDate },
      },
    });
  }

  async findPendingSuggestions(
    assetIds: string[],
    limit: number,
    cursor?: string,
  ): Promise<EventSuggestionRow[]> {
    return this.db.client.investmentEventSuggestion.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { event: true },
      orderBy: [{ event: { record_date: 'desc' } }, { id: 'asc' }],
      take: limit,
      where: { asset_id: { in: assetIds }, status: 'PENDING' },
    });
  }

  async findSuggestionById(id: string): Promise<EventSuggestionRow | null> {
    return this.db.client.investmentEventSuggestion.findUnique({
      include: { event: true },
      where: { id },
    });
  }

  async findSuggestionInputs(
    keys: { market: string; ticker: string }[],
  ): Promise<EventSuggestionInputsRow> {
    const assets = await this.db.client.investmentAsset.findMany({
      select: {
        asset_class: true,
        id: true,
        operations: { select: POSITION_SELECT },
        ticker: true,
      },
      where: {
        asset_class: { in: ['BR_STOCK', 'BR_REIT', 'FOREIGN_STOCK'] },
        OR: keys.map((key) => ({ ticker: key.ticker })),
        status: 'ACTIVE',
      },
    });
    const wanted = new Set(keys.map((key) => `${key.market}:${key.ticker}`));
    const matched = assets.flatMap((asset) => {
      const market = asset.asset_class === 'FOREIGN_STOCK' ? 'US' : 'B3';

      return asset.ticker && wanted.has(`${market}:${asset.ticker}`)
        ? [
            {
              asset_class: asset.asset_class,
              asset_id: asset.id,
              market,
              operations: asset.operations,
              ticker: asset.ticker,
            },
          ]
        : [];
    });
    const existing = await this.db.client.investmentEventSuggestion.findMany({
      select: { asset_id: true, event_id: true },
      where: { asset_id: { in: matched.map((asset) => asset.asset_id) } },
    });

    return { assets: matched, existing };
  }

  async rejectSuggestion(id: string, userId: string): Promise<void> {
    await this.db.client.investmentEventSuggestion.update({
      data: { decided_at: new Date(), decided_by: userId, status: 'REJECTED' },
      where: { id },
    });
  }

  // Holds a transaction-level advisory lock for the whole run: it is released when the transaction ends.
  async runExclusive(key: number, fn: () => Promise<void>): Promise<boolean> {
    return this.db.client.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<{ locked: boolean }[]>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${key}) AS locked`,
        );

        if (!row?.locked) {
          return false;
        }

        await fn();

        return true;
      },
      { maxWait: 5000, timeout: 120_000 },
    );
  }

  async upsertEvents(rows: CorporateEventUpsert[]): Promise<number> {
    for (const row of rows) {
      const data = {
        bonus_percent: row.bonusPercent,
        bonus_unit_cost: row.bonusUnitCost,
        currency: row.currency,
        fetched_at: row.fetchedAt,
        market: row.market,
        ratio_from: row.ratioFrom,
        ratio_to: row.ratioTo,
        record_date: InvestmentMapper.fromCalendarDate(row.recordDate),
        source: row.source,
        ticker: row.ticker,
        type: row.type,
      };

      await this.db.client.investmentCorporateEvent.upsert({
        create: { ...data, event_key: row.eventKey },
        update: data,
        where: { event_key: row.eventKey },
      });
    }

    return rows.length;
  }
}
