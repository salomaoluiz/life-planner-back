import { Inject, Injectable } from '@nestjs/common';

import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { QuoteMapper } from '@investment/data/datasource/mapper/QuoteMapper';
import { IQuoteDatasource } from '@investment/data/repository/datasource/IQuoteDatasource';
import {
  FxRateEntity,
  PriceHistoryRow,
  QuoteEntity,
  QuoteUpsert,
  TrackedSymbol,
} from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { FxHistoryRow, IQuoteRepository, QuoteKey } from '@investment/domain/repository';

@Injectable()
export class QuoteRepository implements IQuoteRepository {
  constructor(
    @Inject('IQuoteDatasource')
    private readonly datasource: IQuoteDatasource,
  ) {}

  async findFx(pair: string): Promise<FxRateEntity | undefined> {
    const row = await this.datasource.findFx(pair);

    return row ? QuoteMapper.toFx(row) : undefined;
  }

  async findFxHistory(pair: string, from: string, to: string): Promise<FxHistoryRow[]> {
    const rows = await this.datasource.findFxHistory(
      pair,
      InvestmentMapper.fromCalendarDate(from),
      InvestmentMapper.fromCalendarDate(to),
    );

    return rows.map(toFxHistory);
  }

  async findFxOnOrBefore(pair: string, date: string): Promise<string | undefined> {
    const row = await this.datasource.findFxOnOrBefore(
      pair,
      InvestmentMapper.fromCalendarDate(date),
    );

    return row ? row.rate.toFixed(6) : undefined;
  }

  async findHistory(
    market: QuoteMarket,
    ticker: string,
    from: string,
    to: string,
  ): Promise<PriceHistoryRow[]> {
    const rows = await this.datasource.findHistory(
      market,
      ticker,
      InvestmentMapper.fromCalendarDate(from),
      InvestmentMapper.fromCalendarDate(to),
    );

    return rows.map((row) => QuoteMapper.toHistory(row));
  }

  async findQuotes(keys: QuoteKey[]): Promise<QuoteEntity[]> {
    const rows = await this.datasource.findQuotes(keys);

    return rows.map((row) => QuoteMapper.toQuote(row));
  }

  async findTrackedSymbols(since: string): Promise<TrackedSymbol[]> {
    const tracked = await this.datasource.findTrackedSymbols(
      InvestmentMapper.fromCalendarDate(since),
    );
    const quotes = await this.datasource.findQuotes(tracked);
    const fetched = new Map(quotes.map((row) => [`${row.market}:${row.ticker}`, row.fetched_at]));

    return tracked.map((key) => ({
      fetchedAt: fetched.get(`${key.market}:${key.ticker}`) ?? null,
      market: key.market as QuoteMarket,
      ticker: key.ticker,
    }));
  }

  async hasHistory(market: QuoteMarket, ticker: string): Promise<boolean> {
    return this.datasource.hasHistory(market, ticker);
  }

  async markMissing(keys: QuoteKey[]): Promise<void> {
    await this.datasource.markMissing(keys);
  }

  async markQuoteErrors(keys: QuoteKey[], at: Date): Promise<void> {
    await this.datasource.markQuoteErrors(keys, at);
  }

  async runExclusive(key: number, fn: () => Promise<void>): Promise<boolean> {
    return this.datasource.runExclusive(key, fn);
  }

  async saveFx(rate: FxRateEntity): Promise<void> {
    await this.datasource.saveFx({
      pair: rate.pair,
      quoted_at: rate.quotedAt,
      rate: rate.rate,
      source: rate.source,
    });
  }

  async saveFxHistory(rows: FxHistoryRow[]): Promise<void> {
    await this.datasource.saveFxHistory(
      rows.map((row) => ({
        date: InvestmentMapper.fromCalendarDate(row.date),
        pair: row.pair,
        rate: row.rate,
        source: row.source,
      })),
    );
  }

  async saveHistory(rows: PriceHistoryRow[]): Promise<void> {
    await this.datasource.saveHistory(
      rows.map((row) => ({
        close: row.close.toFixed8(),
        date: InvestmentMapper.fromCalendarDate(row.date),
        market: row.market,
        source: row.source,
        ticker: row.ticker,
      })),
    );
  }

  async saveQuotes(rows: QuoteUpsert[], fetchedAt: Date): Promise<void> {
    await this.datasource.saveQuotes(
      rows.map((row) => ({
        change_percent: row.changePercent,
        currency: row.currency,
        day_high: row.dayHigh,
        day_low: row.dayLow,
        logo_url: row.logoUrl,
        market: row.market,
        name: row.name,
        previous_close: row.previousClose,
        price: row.price,
        quoted_at: row.quotedAt,
        source: row.source,
        ticker: row.ticker,
      })),
      fetchedAt,
    );
  }
}

function toFxHistory(row: {
  date: Date;
  pair: string;
  rate: { toFixed(places: number): string };
  source: string;
}): FxHistoryRow {
  return {
    date: InvestmentMapper.toCalendarDate(row.date),
    pair: row.pair,
    rate: row.rate.toFixed(6),
    source: row.source,
  };
}
