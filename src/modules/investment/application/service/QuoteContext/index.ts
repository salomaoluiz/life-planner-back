import { Inject, Injectable } from '@nestjs/common';

import { FixedIncomeData } from '@investment/domain/entity/FixedIncomeEntity';
import { FxRateEntity, QuoteEntity } from '@investment/domain/entity/QuoteEntity';
import { IInvestmentRepository, IQuoteRepository } from '@investment/domain/repository';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';

export const USD_BRL = 'USD-BRL';

// What the position needs from market data, read once per request (spec 104 FR 22: at most 2 queries).
export interface QuoteContext {
  // Spec 105: terms, rates and adjustments of the calculated titles, by asset id.
  fixedIncome: Map<string, FixedIncomeData>;
  fx: FxRateEntity | null;
  now: Date;
  quotes: Map<string, QuoteEntity>;
}

export function emptyContext(now = new Date()): QuoteContext {
  return { fixedIncome: new Map(), fx: null, now, quotes: new Map() };
}
export function quoteKey(market: string, ticker: string): string {
  return `${market}:${ticker}`;
}

@Injectable()
export class QuoteContextLoader {
  constructor(
    @Inject('IQuoteRepository')
    private readonly repository: IQuoteRepository,
    @Inject('IInvestmentRepository')
    private readonly investments: IInvestmentRepository,
  ) {}

  async load(
    assets: { assetClass: string; currency: string; id: string; ticker: null | string }[],
  ): Promise<QuoteContext> {
    const keys = new Map<
      string,
      { market: NonNullable<ReturnType<typeof marketOfClass>>; ticker: string }
    >();

    for (const asset of assets) {
      const market = marketOfClass(asset.assetClass);

      if (market && asset.ticker) {
        keys.set(quoteKey(market, asset.ticker), { market, ticker: asset.ticker });
      }
    }

    const needsFx = assets.some((asset) => asset.currency === 'USD');
    const fixedIncomeIds = assets
      .filter((asset) => asset.assetClass === 'FIXED_INCOME')
      .map((asset) => asset.id);
    const [quotes, fx, fixedIncome] = await Promise.all([
      keys.size > 0 ? this.repository.findQuotes([...keys.values()]) : Promise.resolve([]),
      needsFx ? this.repository.findFx(USD_BRL) : Promise.resolve(undefined),
      fixedIncomeIds.length > 0
        ? this.investments.findFixedIncomeByAssetIds(fixedIncomeIds)
        : Promise.resolve(new Map()),
    ]);

    return {
      fixedIncome,
      fx: fx ?? null,
      now: new Date(),
      quotes: new Map(quotes.map((quote) => [quoteKey(quote.market, quote.ticker), quote])),
    };
  }
}
