import { Test } from '@nestjs/testing';

import { RefreshMarketIndexesUseCase } from '@investment/application/use-case/RefreshMarketIndexesUseCase';
import { EnvService } from '@shared/infra/env/env.service';

import { RefreshMarketIndexesNowUseCase } from './index';

export const spies = { cooldown: 60000, refresh: jest.fn() };

export async function setup(): Promise<RefreshMarketIndexesNowUseCase> {
  const module = await Test.createTestingModule({
    providers: [
      RefreshMarketIndexesNowUseCase,
      { provide: RefreshMarketIndexesUseCase, useValue: { execute: spies.refresh } },
      {
        provide: EnvService,
        useValue: {
          get investmentQuoteRefreshCooldownMs() {
            return spies.cooldown;
          },
        },
      },
    ],
  }).compile();

  return module.get(RefreshMarketIndexesNowUseCase);
}
