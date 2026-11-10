import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

import {
  DailyClose,
  IBrapiQuotes,
  normalizeTicker,
  QuoteResult,
  QuoteSourceUnavailableError,
  toSourceError,
} from '../types';

const BRAPI_API = 'https://brapi.dev/api';
const TIMEOUT_MS = 5000;
const MAX_SEARCH_RESULTS = 10;

interface RawHistory {
  close?: null | number;
  date?: number;
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

function asText(value: null | number | undefined): null | string {
  return typeof value === 'number' ? String(value) : null;
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

  async getQuotes(symbols: string[]): Promise<QuoteResult[]> {
    if (symbols.length === 0) {
      return [];
    }
    const list = symbols.map((symbol) => normalizeTicker(symbol)).join(',');
    const data = await this.request<{ results?: RawQuote[] }>(`/quote/${list}`, {});
    return (data.results ?? []).flatMap((raw) => {
      const quote = toQuote(raw);
      return quote ? [quote] : [];
    });
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
