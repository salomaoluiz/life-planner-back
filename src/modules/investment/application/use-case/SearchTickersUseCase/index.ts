import { Inject, Injectable } from '@nestjs/common';

import { SearchTickersInput, SearchTickersSchema } from '@investment/application/dto/Quotes';
import { sourceUnavailable } from '@investment/application/service/TickerValidator';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IBrapiQuotes, IFinnhubQuotes, QuoteResult } from '@shared/infra/quotes/types';
import { validate } from '@shared/infra/validation';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CURRENCY: Record<QuoteMarket, string> = { [QuoteMarket.B3]: 'BRL', [QuoteMarket.US]: 'USD' };

export interface TickerSearchItem {
  changePercent: null | string;
  currency: string;
  exchange: string;
  logoUrl: null | string;
  market: QuoteMarket;
  name: null | string;
  price: string;
  ticker: string;
}

interface CacheEntry {
  at: number;
  items: TickerSearchItem[];
}

// Spec 104 FR 23, 26: ticker autocomplete; results are kept 10 minutes per (market, query) to save quota.
@Injectable()
export class SearchTickersUseCase implements UseCaseWithParams<
  SearchTickersInput,
  TickerSearchItem[]
> {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject('IBrapiQuotes') private readonly brapi: IBrapiQuotes,
    @Inject('IFinnhubQuotes') private readonly finnhub: IFinnhubQuotes,
  ) {}

  async execute(params: SearchTickersInput): Promise<TickerSearchItem[]> {
    const input = validate(SearchTickersSchema, params);
    const key = `${input.market}:${input.q.toLowerCase()}`;
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.items;
    }

    let results: QuoteResult[];

    try {
      results = await (input.market === QuoteMarket.B3 ? this.brapi : this.finnhub).search(input.q);
    } catch {
      throw sourceUnavailable();
    }

    const items = results.map((result) => ({
      changePercent: result.changePercent,
      currency: CURRENCY[input.market],
      exchange: input.market,
      logoUrl: result.logoUrl,
      market: input.market,
      name: result.name,
      price: result.price,
      ticker: result.ticker,
    }));

    this.cache.set(key, { at: Date.now(), items });

    return items;
  }
}
