import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

import {
  B3TickerKind,
  CorporateEventResult,
  DailyClose,
  IBrapiQuotes,
  IncomeEventResult,
  IncomeEventType,
  normalizeTicker,
  QuoteResult,
  QuoteSourceUnavailableError,
  toSourceError,
} from '../types';

const BRAPI_API = 'https://brapi.dev/api';
const TIMEOUT_MS = 5000;
const MAX_SEARCH_RESULTS = 10;

interface RawCashDividend {
  label?: null | string;
  lastDatePrior?: null | string;
  paymentDate?: null | string;
  rate?: null | number;
}
interface RawHistory {
  close?: null | number;
  date?: number;
}
interface RawKind {
  name?: null | string;
  stock?: string;
  subType?: null | string;
  type?: null | string;
}
interface RawQuote {
  logourl?: null | string;
  longName?: null | string;
  regularMarketChangePercent?: null | number;
  regularMarketDayHigh?: null | number;
  regularMarketDayLow?: null | number;
  regularMarketPreviousClose?: null | number;
  regularMarketPrice?: null | number;
  regularMarketTime?: null | number | string;
  shortName?: null | string;
  symbol?: string;
}
interface RawStockDividend {
  factor?: null | number;
  label?: null | string;
  lastDatePrior?: null | string;
}

function asDay(value: null | string | undefined): null | string {
  const day = typeof value === 'string' ? value.slice(0, 10) : '';

  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}
// brapi labels (`DIVIDENDO`, `JRS CAP PROPRIO`, `RENDIMENTO`, ...) to the income types.
function asText(value: null | number | undefined): null | string {
  return typeof value === 'number' ? String(value) : null;
}
function plain(value: null | string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}
function toCorporateEvent(
  row: RawStockDividend,
): null | Pick<CorporateEventResult, 'bonusPercent' | 'ratioFrom' | 'ratioTo' | 'type'> {
  const factor = row.factor;
  const label = (row.label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (typeof factor !== 'number' || !(factor > 0)) {
    return null;
  }
  if (label.includes('DESDOBRAMENTO')) {
    return factor > 1 ? { ratioFrom: '1', ratioTo: String(factor), type: 'SPLIT' } : null;
  }
  if (label.includes('GRUPAMENTO')) {
    return factor < 1
      ? { ratioFrom: String(Number((1 / factor).toFixed(8))), ratioTo: '1', type: 'REVERSE_SPLIT' }
      : null;
  }
  if (label.includes('BONIFICACAO')) {
    return factor <= 1000 ? { bonusPercent: String(factor), type: 'BONUS' } : null;
  }

  return null;
}
// Spec 111 rule 1: `type` + `subType` of brapi's `/quote/list`; a fund without a sub-type is told by its name and
// never falls through to a guess (a wrong guess would refuse a legitimate save).
function toIncomeType(label: null | string | undefined): IncomeEventType {
  const text = (label ?? '').toUpperCase();

  if (text.startsWith('JRS') || text.includes('JUROS SOBRE CAPITAL')) {
    return 'JCP';
  }
  if (text.includes('RENDIMENTO')) {
    return 'YIELD';
  }

  return text.includes('DIVIDENDO') ? 'DIVIDEND' : 'OTHER';
}
function toTickerKind(raw: RawKind): B3TickerKind {
  if (raw.type === 'stock') {
    return 'STOCK';
  }
  if (raw.type === 'bdr') {
    return 'BDR';
  }
  if (raw.type !== 'fund') {
    return 'UNKNOWN';
  }
  if (raw.subType === 'etf') {
    return 'ETF';
  }
  if (raw.subType === 'fii') {
    return 'REIT';
  }
  if (raw.subType === 'fi-agro') {
    return 'FIAGRO';
  }
  if (raw.subType) {
    return 'UNKNOWN';
  }

  const name = plain(raw.name);

  if (/\b(ETF|INDICE|ISHARES)\b/.test(name)) {
    return 'ETF';
  }
  if (/FI-?AGRO/.test(name)) {
    return 'FIAGRO';
  }

  return /\b(FII|IMOBILIARIO)\b/.test(name) ? 'REIT' : 'UNKNOWN';
}
// `QUOTES_PER_REQUEST_EXCEEDED` ("... no máximo N ativo(s) por requisição ...") -> N; anything else -> null.
function isNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}
function perRequestLimit(error: unknown): null | number {
  const data = (error as { response?: { data?: { code?: string; message?: string } } })?.response
    ?.data;

  if (data?.code !== 'QUOTES_PER_REQUEST_EXCEEDED') {
    return null;
  }

  const limit = Number(/(\d+)\s+ativo/.exec(data.message ?? '')?.[1]);

  return Number.isInteger(limit) && limit > 0 ? limit : 1;
}
function toQuote(raw: RawQuote): null | QuoteResult {
  if (!raw.symbol || typeof raw.regularMarketPrice !== 'number' || raw.regularMarketPrice <= 0) {
    return null;
  }

  const time = raw.regularMarketTime ? new Date(raw.regularMarketTime) : new Date();

  return {
    changePercent: asText(raw.regularMarketChangePercent),
    dayHigh: asText(raw.regularMarketDayHigh),
    dayLow: asText(raw.regularMarketDayLow),
    logoUrl: raw.logourl ?? null,
    name: raw.longName ?? raw.shortName ?? null,
    previousClose: asText(raw.regularMarketPreviousClose),
    price: String(raw.regularMarketPrice),
    quotedAt: Number.isNaN(time.getTime()) ? new Date() : time,
    ticker: raw.symbol.toUpperCase(),
  };
}
@Injectable()
export class BrapiQuotes implements IBrapiQuotes {
  private maxPerRequest: null | number = null;

  constructor(private readonly env: EnvService) {}

  async getDailyHistory(symbol: string, range: string): Promise<DailyClose[]> {
    const data = await this.request<{ results?: { historicalDataPrice?: RawHistory[] }[] }>(
      `/quote/${normalizeTicker(symbol)}`,
      { interval: '1d', range },
    );
    const prices = data.results?.[0]?.historicalDataPrice ?? [];
    return prices
      .filter((row) => typeof row.close === 'number' && typeof row.date === 'number')
      .map((row) => ({
        close: String(row.close),
        date: new Date((row.date as number) * 1000).toISOString().slice(0, 10),
      }));
  }

  // Spec 108: `stockDividends` of the same quote response (DESDOBRAMENTO, GRUPAMENTO, BONIFICACAO). Unknown labels,
  // a factor that points the wrong way and rows without a data-com are ignored.
  async getCorporateEvents(symbol: string): Promise<CorporateEventResult[]> {
    const ticker = normalizeTicker(symbol);
    const data = await this.request<{
      results?: { dividendsData?: { stockDividends?: RawStockDividend[] } }[];
    }>(`/quote/${ticker}`, { dividends: 'true' });
    const rows = data.results?.[0]?.dividendsData?.stockDividends ?? [];

    return rows.flatMap((row) => {
      const recordDate = asDay(row.lastDatePrior);
      const event = recordDate ? toCorporateEvent(row) : null;

      return recordDate && event ? [{ ...event, currency: 'BRL', recordDate, ticker }] : [];
    });
  }

  async getIncomeEvents(symbol: string): Promise<IncomeEventResult[]> {
    const ticker = normalizeTicker(symbol);
    const data = await this.request<{
      results?: { dividendsData?: { cashDividends?: RawCashDividend[] } }[];
    }>(`/quote/${ticker}`, { dividends: 'true' });
    const rows = data.results?.[0]?.dividendsData?.cashDividends ?? [];

    return rows.flatMap((row) => {
      const exDate = asDay(row.lastDatePrior);

      if (!exDate || typeof row.rate !== 'number' || !(row.rate > 0)) {
        return [];
      }

      return [
        {
          amountPerUnit: String(row.rate),
          currency: 'BRL',
          exDate,
          paymentDate: asDay(row.paymentDate),
          ticker,
          type: toIncomeType(row.label),
        },
      ];
    });
  }

  // Spec 111: one `/quote/list` call gives symbol, name and kind of every match.
  async getKinds(query: string): Promise<Record<string, B3TickerKind>> {
    const data = await this.request<{ stocks?: RawKind[] }>('/quote/list', {
      search: query.trim().slice(0, 20),
    });
    const kinds: Record<string, B3TickerKind> = {};

    for (const raw of data.stocks ?? []) {
      if (raw.stock && /^[A-Z0-9.-]{1,12}$/.test(raw.stock)) {
        kinds[raw.stock] = toTickerKind(raw);
      }
    }

    return kinds;
  }

  // The free plan takes ONE ticker per request: the first `QUOTES_PER_REQUEST_EXCEEDED` answer teaches the limit and
  // the rest of the symbols go in chunks of that size, one request after the other.
  async getQuotes(symbols: string[]): Promise<QuoteResult[]> {
    const tickers = symbols.map((symbol) => normalizeTicker(symbol));
    const results: QuoteResult[] = [];
    let index = 0;

    while (index < tickers.length) {
      const chunk = tickers.slice(index, index + (this.maxPerRequest ?? tickers.length));

      try {
        results.push(...(await this.quoteChunk(chunk)));
        index += chunk.length;
      } catch (error) {
        if (isNotFound(error)) {
          // brapi answers 404 for an unknown ticker: ask one by one, so the known ones still come back.
          results.push(...(await this.quoteEach(chunk)));
          index += chunk.length;
          continue;
        }

        const limit = perRequestLimit(error);

        if (limit === null || limit >= chunk.length) {
          throw error;
        }

        this.maxPerRequest = limit;
      }
    }

    return results;
  }

  private async quoteChunk(tickers: string[]): Promise<QuoteResult[]> {
    const data = await this.request<{ results?: RawQuote[] }>(`/quote/${tickers.join(',')}`, {});

    return (data.results ?? []).flatMap((raw) => {
      const quote = toQuote(raw);
      return quote ? [quote] : [];
    });
  }

  private async quoteEach(tickers: string[]): Promise<QuoteResult[]> {
    const results: QuoteResult[] = [];

    for (const ticker of tickers) {
      try {
        results.push(...(await this.quoteChunk([ticker])));
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
      }
    }

    return results;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const token = this.env.brapiToken;
    if (!token) {
      throw new QuoteSourceUnavailableError('brapi');
    }
    try {
      const response = await axios.get<T>(`${BRAPI_API}${path}`, {
        params: { ...params, token },
        timeout: TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      throw toSourceError(error);
    }
  }

  async search(query: string): Promise<QuoteResult[]> {
    const data = await this.request<{ stocks?: string[] }>('/available', {
      search: query.trim().slice(0, 20),
    });
    const symbols = (data.stocks ?? [])
      .filter((symbol) => /^[A-Z0-9.-]{1,12}$/.test(symbol))
      .slice(0, MAX_SEARCH_RESULTS);
    return this.getQuotes(symbols);
  }
}
