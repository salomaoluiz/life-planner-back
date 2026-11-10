import { Inject, Injectable } from '@nestjs/common';

import { RefreshTrackedInput, RefreshTrackedSchema } from '@investment/application/dto/Quotes';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { IQuoteRepository } from '@investment/domain/repository';
import { addDays, marketDateOf } from '@investment/domain/service/MarketDate';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// One advisory lock per target, so two instances never fetch the same source at the same time (spec 104 FR 11).
const LOCK_KEYS = { B3: 104001, FX: 104003, US: 104002 } as const;
const TRACK_WINDOW_DAYS = 30;

export interface RefreshTrackedResult {
  failed: number;
  fetched: number;
  skipped: boolean;
}

// Spec 104 FR 5-12: what the scheduled job runs. Reads never call an external API; this is the only path.
@Injectable()
export class RefreshTrackedQuotesUseCase implements UseCaseWithParams<
  RefreshTrackedInput,
  RefreshTrackedResult
> {
  constructor(
    @Inject('IQuoteRepository') private readonly repository: IQuoteRepository,
    private readonly fetcher: QuoteFetcher,
  ) {}

  async execute(params: RefreshTrackedInput): Promise<RefreshTrackedResult> {
    const input = validate(RefreshTrackedSchema, params);
    const result: RefreshTrackedResult = { failed: 0, fetched: 0, skipped: false };
    const now = new Date();

    const ran = await this.repository.runExclusive(LOCK_KEYS[input.target], async () => {
      if (input.target === 'FX') {
        result.fetched = (await this.fetcher.fetchFx(now)) ? 1 : 0;
        return;
      }

      const market = QuoteMarket[input.target];
      const since = addDays(marketDateOf(now, market), -TRACK_WINDOW_DAYS);
      const tracked = (await this.repository.findTrackedSymbols(since)).filter(
        (symbol) => symbol.market === market,
      );
      const outcome = await this.fetcher.fetchMarket(market, tracked, {
        closeRun: input.closeRun,
        now,
      });

      result.failed = outcome.failed.length;
      result.fetched = outcome.fetched;
    });

    result.skipped = !ran;

    return result;
  }
}
