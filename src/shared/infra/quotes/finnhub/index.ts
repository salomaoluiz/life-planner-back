import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

import {
  CorporateEventResult,
  IFinnhubQuotes,
  IncomeEventResult,
  normalizeTicker,
  QuoteResult,
  QuoteSourceUnavailableError,
  toSourceError,
} from '../types';

const FINNHUB_API = 'https://finnhub.io/api/v1';
const TIMEOUT_MS = 5000;
const MAX_SEARCH_RESULTS = 10;

interface RawDividend {
  amount?: null | number;
  currency?: null | string;
  date?: null | string;
  payDate?: null | string;
}
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
interface RawSplit {
  date?: null | string;
  fromFactor?: null | number;
  toFactor?: null | number;
}

function asDay(value: null | string | undefined): null | string {
  const day = typeof value === 'string' ? value.slice(0, 10) : '';

  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}
function asText(value: null | number | undefined): null | string {
  return typeof value === 'number' ? String(value) : null;
}
function dayBefore(day: string): string {
  const value = new Date(`${day}T00:00:00.000Z`);

  value.setUTCDate(value.getUTCDate() - 1);

  return value.toISOString().slice(0, 10);
}

@Injectable()
export class FinnhubQuotes implements IFinnhubQuotes {
  constructor(private readonly env: EnvService) {}
  // Spec 108: the splits endpoint may be premium (403 = "no events", manual only). Finnhub dates a split by its
  // effective day, so the data-com (last day with rights) is the day before.
  async getCorporateEvents(symbol: string): Promise<CorporateEventResult[]> {
    const ticker = normalizeTicker(symbol);
    const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let data: RawSplit[];

    try {
      data = await this.request<RawSplit[]>('/stock/split', { from, symbol: ticker, to });
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 403) {
        return [];
      }

      throw error;
    }

    return data.flatMap((row) => {
      const effective = asDay(row.date);
      const { fromFactor, toFactor } = row;

      if (
        !effective ||
        typeof fromFactor !== 'number' ||
        typeof toFactor !== 'number' ||
        !(fromFactor > 0) ||
        !(toFactor > 0) ||
        fromFactor === toFactor
      ) {
        return [];
      }

      return [
        {
          currency: 'USD',
          ratioFrom: String(fromFactor),
          ratioTo: String(toFactor),
          recordDate: dayBefore(effective),
          ticker,
          type: toFactor > fromFactor ? ('SPLIT' as const) : ('REVERSE_SPLIT' as const),
        },
      ];
    });
  }

  // The dividends endpoint may be premium: a 403 answer means "no events" (manual incomes only, spec 107 FR 24a).
  async getIncomeEvents(symbol: string): Promise<IncomeEventResult[]> {
    const ticker = normalizeTicker(symbol);
    const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let data: { data?: RawDividend[] } | RawDividend[];

    try {
      data = await this.request<{ data?: RawDividend[] } | RawDividend[]>('/stock/dividend', {
        from,
        symbol: ticker,
        to,
      });
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 403) {
        return [];
      }

      throw error;
    }

    const rows = Array.isArray(data) ? data : (data.data ?? []);

    return rows.flatMap((row) => {
      const exDate = asDay(row.date);

      if (!exDate || typeof row.amount !== 'number' || !(row.amount > 0)) {
        return [];
      }

      return [
        {
          amountPerUnit: String(row.amount),
          currency: row.currency ?? 'USD',
          exDate,
          paymentDate: asDay(row.payDate),
          ticker,
          type: 'DIVIDEND' as const,
        },
      ];
    });
  }

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
