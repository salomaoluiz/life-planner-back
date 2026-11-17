import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import {
  RefreshMarketIndexesNowInput,
  RefreshMarketIndexesNowSchema,
} from '@investment/application/dto/MarketIndex';
import { RefreshMarketIndexesUseCase } from '@investment/application/use-case/RefreshMarketIndexesUseCase';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { EnvService } from '@shared/infra/env/env.service';
import { validate } from '@shared/infra/validation';

export const MARKET_REFRESH_TOO_SOON_CODE = 'REFRESH_TOO_SOON';

// Spec 113 FR 9: fetches the stale or missing series right now, at most once per user per cooldown (in memory, a
// single API instance, like the quotes refresh of spec 104).
@Injectable()
export class RefreshMarketIndexesNowUseCase implements UseCaseWithParams<
  RefreshMarketIndexesNowInput,
  void
> {
  private readonly lastCall = new Map<string, number>();

  constructor(
    private readonly refresh: RefreshMarketIndexesUseCase,
    private readonly env: EnvService,
  ) {}

  async execute(params: RefreshMarketIndexesNowInput): Promise<void> {
    const input = validate(RefreshMarketIndexesNowSchema, params);
    const cooldown = this.env.investmentQuoteRefreshCooldownMs;
    const now = Date.now();
    const last = this.lastCall.get(input.userId);

    if (last !== undefined && now - last < cooldown) {
      throw new HttpException(
        {
          code: MARKET_REFRESH_TOO_SOON_CODE,
          message: 'Wait 1 minute to refresh again',
          retryAfterSeconds: Math.ceil((cooldown - (now - last)) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.lastCall.set(input.userId, now);
    await this.refresh.execute({ onlyStale: true });
  }
}
