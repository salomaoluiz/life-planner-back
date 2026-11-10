import { FxRate, InvestmentPriceHistory, InvestmentQuote } from '@db/client';
import { InvestmentMapper } from '@investment/data/datasource/mapper/InvestmentMapper';
import { FxRateEntity, PriceHistoryRow, QuoteEntity } from '@investment/domain/entity/QuoteEntity';
import { QuoteMarket, QuoteSource } from '@investment/domain/enum/QuoteMarket';

export class QuoteMapper {
  static toFx(row: FxRate): FxRateEntity {
    return {
      pair: row.pair,
      quotedAt: row.quoted_at,
      rate: row.rate.toFixed(6),
      source: row.source,
    };
  }

  static toHistory(row: InvestmentPriceHistory): PriceHistoryRow {
    return {
      close: InvestmentMapper.toDecimal(row.close),
      date: InvestmentMapper.toCalendarDate(row.date),
      market: QuoteMarket[row.market],
      source: QuoteSource[row.source],
      ticker: row.ticker,
    };
  }

  static toQuote(row: InvestmentQuote): QuoteEntity {
    return {
      changePercent: row.change_percent ? row.change_percent.toFixed(4) : null,
      currency: row.currency,
      dayHigh: optionalDecimal(row.day_high),
      dayLow: optionalDecimal(row.day_low),
      fetchedAt: row.fetched_at,
      lastErrorAt: row.last_error_at,
      logoUrl: row.logo_url,
      market: QuoteMarket[row.market],
      missingDays: row.missing_days,
      name: row.name,
      previousClose: optionalDecimal(row.previous_close),
      price: InvestmentMapper.toDecimal(row.price),
      quotedAt: row.quoted_at,
      source: QuoteSource[row.source],
      ticker: row.ticker,
      unavailable: row.unavailable,
    };
  }
}

function optionalDecimal(value: { toFixed(places: number): string } | null) {
  return value ? InvestmentMapper.toDecimal(value) : null;
}
