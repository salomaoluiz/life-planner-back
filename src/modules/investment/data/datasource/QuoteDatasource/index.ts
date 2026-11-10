import { Injectable } from '@nestjs/common';

import { FxRate, FxRateHistory, InvestmentPriceHistory, InvestmentQuote, Prisma } from '@db/client';
import {
  IQuoteDatasource,
  QuoteDatasourceKey,
  QuoteDatasourceUpsert,
} from '@investment/data/repository/datasource/IQuoteDatasource';
import { Database } from '@shared/infra/db/Database';

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const MISSING_DAYS_LIMIT = 5;

@Injectable()
export class QuoteDatasource implements IQuoteDatasource {
  constructor(private readonly db: Database) {}

  async findFx(pair: string): Promise<FxRate | null> {
    return this.db.client.fxRate.findUnique({ where: { pair } });
  }

  async findFxHistory(pair: string, from: Date, to: Date): Promise<FxRateHistory[]> {
    return this.db.client.fxRateHistory.findMany({
      orderBy: { date: 'asc' },
      where: { date: { gte: from, lte: to }, pair },
    });
  }

  async findFxOnOrBefore(pair: string, date: Date): Promise<FxRateHistory | null> {
    return this.db.client.fxRateHistory.findFirst({
      orderBy: { date: 'desc' },
      where: { date: { lte: date }, pair },
    });
  }

  async findHistory(
    market: string,
    ticker: string,
    from: Date,
    to: Date,
  ): Promise<InvestmentPriceHistory[]> {
    return this.db.client.investmentPriceHistory.findMany({
      orderBy: { date: 'asc' },
      where: {
        date: { gte: from, lte: to },
        market: market as InvestmentPriceHistory['market'],
        ticker,
      },
    });
  }

  async findQuotes(keys: QuoteDatasourceKey[]): Promise<InvestmentQuote[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.db.client.investmentQuote.findMany({ where: { OR: keys.map(toWhere) } });
  }

  async findTrackedSymbols(since: Date): Promise<QuoteDatasourceKey[]> {
    return this.db.client.$queryRaw<QuoteDatasourceKey[]>(Prisma.sql`
      SELECT DISTINCT
        CASE WHEN a.asset_class = 'FOREIGN_STOCK' THEN 'US' ELSE 'B3' END AS market,
        a.ticker AS ticker
      FROM investment_assets a
      WHERE a.status = 'ACTIVE'
        AND a.ticker IS NOT NULL
        AND a.asset_class IN ('BR_STOCK', 'BR_REIT', 'FOREIGN_STOCK')
        AND (
          COALESCE((
            SELECT SUM(CASE WHEN o.type = 'BUY' THEN o.quantity ELSE -o.quantity END)
            FROM investment_operations o WHERE o.asset_id = a.id
          ), 0) > 0
          OR EXISTS (
            SELECT 1 FROM investment_operations o WHERE o.asset_id = a.id AND o.date >= ${since}
          )
        )
    `);
  }

  async hasHistory(market: string, ticker: string): Promise<boolean> {
    const found = await this.db.client.investmentPriceHistory.findFirst({
      select: { id: true },
      where: { market: market as InvestmentPriceHistory['market'], ticker },
    });

    return found !== null;
  }

  async markMissing(keys: QuoteDatasourceKey[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    const where = { OR: keys.map(toWhere) };

    await this.db.client.$transaction([
      this.db.client.investmentQuote.updateMany({
        data: { missing_days: { increment: 1 } },
        where,
      }),
      this.db.client.investmentQuote.updateMany({
        data: { unavailable: true },
        where: { ...where, missing_days: { gte: MISSING_DAYS_LIMIT } },
      }),
    ]);
  }

  async markQuoteErrors(keys: QuoteDatasourceKey[], at: Date): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await this.db.client.investmentQuote.updateMany({
      data: { last_error_at: at },
      where: { OR: keys.map(toWhere) },
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
      { maxWait: 5000, timeout: LOCK_TIMEOUT_MS },
    );
  }

  async saveFx(row: {
    pair: string;
    quoted_at: Date;
    rate: string;
    source: string;
  }): Promise<void> {
    await this.db.client.fxRate.upsert({
      create: row,
      update: { quoted_at: row.quoted_at, rate: row.rate, source: row.source },
      where: { pair: row.pair },
    });
  }

  async saveFxHistory(
    rows: { date: Date; pair: string; rate: string; source: string }[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.db.client.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.fxRateHistory.upsert({
          create: row,
          update: { rate: row.rate, source: row.source },
          where: { pair_date: { date: row.date, pair: row.pair } },
        });
      }
    });
  }

  async saveHistory(
    rows: { close: string; date: Date; market: string; source: string; ticker: string }[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.db.client.$transaction(async (tx) => {
      for (const row of rows) {
        const data = {
          close: row.close,
          date: row.date,
          market: row.market as InvestmentPriceHistory['market'],
          source: row.source as InvestmentPriceHistory['source'],
          ticker: row.ticker,
        };

        await tx.investmentPriceHistory.upsert({
          create: data,
          update: { close: data.close, source: data.source },
          where: {
            market_ticker_date: { date: data.date, market: data.market, ticker: data.ticker },
          },
        });
      }
    });
  }

  async saveQuotes(rows: QuoteDatasourceUpsert[], fetchedAt: Date): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.db.client.$transaction(async (tx) => {
      for (const row of rows) {
        const data = {
          change_percent: row.change_percent,
          currency: row.currency,
          day_high: row.day_high,
          day_low: row.day_low,
          fetched_at: fetchedAt,
          last_error_at: null,
          logo_url: row.logo_url,
          missing_days: 0,
          name: row.name,
          previous_close: row.previous_close,
          price: row.price,
          quoted_at: row.quoted_at,
          source: row.source as InvestmentQuote['source'],
          unavailable: false,
        };
        const market = row.market as InvestmentQuote['market'];

        await tx.investmentQuote.upsert({
          create: { ...data, market, ticker: row.ticker },
          update: data,
          where: { market_ticker: { market, ticker: row.ticker } },
        });
      }
    });
  }
}

function toWhere(key: QuoteDatasourceKey) {
  return { market: key.market as InvestmentQuote['market'], ticker: key.ticker };
}
