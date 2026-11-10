import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { RefreshNowInput, RefreshNowSchema } from '@investment/application/dto/Quotes';
import { quoteKey, USD_BRL } from '@investment/application/service/QuoteContext';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { QuoteView, toQuoteView } from '@investment/application/service/QuoteView';
import { FxRateEntity, TrackedSymbol } from '@investment/domain/entity/QuoteEntity';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { IInvestmentRepository, IQuoteRepository } from '@investment/domain/repository';
import { marketOfClass } from '@investment/domain/service/QuoteResolver';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { EnvService } from '@shared/infra/env/env.service';
import { validate } from '@shared/infra/validation';

export const REFRESH_TOO_SOON_CODE = 'REFRESH_TOO_SOON';

export interface RefreshNowResult {
  fx: FxRateEntity | null;
  nextRefreshAt: Date;
  quotes: QuoteView[];
}

// Spec 104 FR 17-19: fetches right now the symbols of the assets the caller can read, at most once per user per
// cooldown (in memory: a single API instance, like the materialization gate of spec 081). A source failure answers
// with the unchanged quote and `stale: true`.
@Injectable()
export class RefreshQuotesNowUseCase implements UseCaseWithParams<
  RefreshNowInput,
  RefreshNowResult
> {
  private readonly lastCall = new Map<string, number>();

  constructor(
    @Inject('IInvestmentRepository') private readonly investments: IInvestmentRepository,
    @Inject('IQuoteRepository') private readonly quotes: IQuoteRepository,
    private readonly fetcher: QuoteFetcher,
    private readonly env: EnvService,
  ) {}

  async execute(params: RefreshNowInput): Promise<RefreshNowResult> {
    const input = validate(RefreshNowSchema, params);
    const cooldown = this.env.investmentQuoteRefreshCooldownMs;
    const now = new Date();
    const last = this.lastCall.get(input.userId);

    if (last !== undefined && now.getTime() - last < cooldown) {
      throw new HttpException(
        {
          code: REFRESH_TOO_SOON_CODE,
          message: 'Quotes were refreshed a moment ago',
          retryAfterSeconds: Math.ceil((cooldown - (now.getTime() - last)) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const assets = await this.investments.findAssetsByOwners(
      input.accessibleOwners,
      InvestmentAssetStatus.ACTIVE,
    );
    const selected = input.assetIds
      ? assets.filter((asset) => input.assetIds?.includes(asset.id))
      : assets;

    if (input.assetIds && selected.length !== new Set(input.assetIds).size) {
      throw new NotFoundException();
    }

    this.lastCall.set(input.userId, now.getTime());

    const byMarket = new Map<QuoteMarket, TrackedSymbol[]>();
    let needsFx = false;

    for (const asset of selected) {
      const market = marketOfClass(asset.assetClass);

      if (asset.currency !== 'BRL') {
        needsFx = true;
      }
      if (market && asset.ticker) {
        const list = byMarket.get(market) ?? [];

        if (!list.some((symbol) => symbol.ticker === asset.ticker)) {
          list.push({ fetchedAt: null, market, ticker: asset.ticker });
        }

        byMarket.set(market, list);
      }
    }

    const failed = new Set<string>();

    for (const [market, symbols] of byMarket) {
      const known = await this.quotes.findQuotes(symbols.map(({ ticker }) => ({ market, ticker })));
      const fetchedAt = new Map(known.map((quote) => [quote.ticker, quote.fetchedAt]));
      const withAge = symbols.map((symbol) => ({
        ...symbol,
        fetchedAt: fetchedAt.get(symbol.ticker) ?? null,
      }));
      const outcome = await this.fetcher.fetchMarket(market, withAge, { closeRun: false, now });

      outcome.failed.forEach((ticker) => failed.add(quoteKey(market, ticker)));
    }

    const fx = needsFx ? await this.fetcher.fetchFx(now) : null;
    const stored = await this.quotes.findQuotes(
      [...byMarket].flatMap(([market, symbols]) =>
        symbols.map(({ ticker }) => ({ market, ticker })),
      ),
    );

    return {
      fx: needsFx ? (fx ?? (await this.quotes.findFx(USD_BRL)) ?? null) : null,
      nextRefreshAt: new Date(now.getTime() + cooldown),
      quotes: stored.map((quote) =>
        toQuoteView(quote, now, failed.has(quoteKey(quote.market, quote.ticker))),
      ),
    };
  }
}
