import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

import {
  IFinnhubQuotes,
  normalizeTicker,
  QuoteResult,
  QuoteSourceUnavailableError,
  toSourceError,
} from '../types';

const FINNHUB_API = 'https://finnhub.io/api/v1';
const TIMEOUT_MS = 5000;
const MAX_SEARCH_RESULTS = 10;

interface RawQuote {
  c?: number;
  dp?: null | number;
  h?: number;
  l?: number;
  pc?: number;
  t?: number;
}
interface RawSearchItem {
  description?: string;
  symbol?: string;
  type?: string;
}

function asText(value: null | number | undefined): null | string {
  return typeof value === 'number' ? String(value) : null;
}

@Injectable()
export class FinnhubQuotes implements IFinnhubQuotes {
  constructor(private readonly env: EnvService) {}
  // One call per symbol (Finnhub has no batch quote). A symbol that fails alone is skipped, a limit error aborts.
  async getQuotes(symbols: string[]): Promise<QuoteResult[]> {
    const results: QuoteResult[] = [];
    for (const symbol of symbols) {
      const ticker = normalizeTicker(symbol);
      const raw = await this.request<RawQuote>('/quote', { symbol: ticker });
      if (typeof raw.c === 'number' && raw.c > 0 && typeof raw.t === 'number' && raw.t > 0) {
        results.push({
          changePercent: asText(raw.dp),
          dayHigh: asText(raw.h),
          dayLow: asText(raw.l),
          logoUrl: null,
          name: null,
          previousClose: asText(raw.pc),
          price: String(raw.c),
          quotedAt: new Date(raw.t * 1000),
          ticker,
        });
      }
    }
    return results;
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const token = this.env.finnhubToken;
    if (!token) {
      throw new QuoteSourceUnavailableError('finnhub');
    }
    try {
      const response = await axios.get<T>(`${FINNHUB_API}${path}`, {
        params: { ...params, token },
        timeout: TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      throw toSourceError(error);
    }
  }

  async search(query: string): Promise<QuoteResult[]> {
    const data = await this.request<{ result?: RawSearchItem[] }>('/search', {
      q: query.trim().slice(0, 20),
    });
    const items = (data.result ?? [])
      .filter((item) => item.symbol && /^[A-Z0-9-]{1,12}$/.test(item.symbol))
      .slice(0, MAX_SEARCH_RESULTS);
    const quotes = await this.getQuotes(items.map((item) => item.symbol as string));
    return quotes.map((quote) => ({
      ...quote,
      name: items.find((item) => item.symbol === quote.ticker)?.description ?? null,
    }));
  }
}
