import { Test } from '@nestjs/testing';

import { quoteRepositorySpies } from '@investment/domain/entity/mocks/investment.fixture';
import { EnvService } from '@shared/infra/env/env.service';
import { QuoteResult } from '@shared/infra/quotes/types';

import { QuoteFetcher } from './index';

export const spies = {
  brapi: { getDailyHistory: jest.fn(), getQuotes: jest.fn(), search: jest.fn() },
  finnhub: { getQuotes: jest.fn(), search: jest.fn() },
  fx: { getUsdBrl: jest.fn() },
  logger: { log: jest.fn() },
  repository: quoteRepositorySpies(),
};

export const mocks = {
  now: new Date('2026-11-04T16:05:00Z'),
  result: (ticker: string, overrides: Partial<QuoteResult> = {}): QuoteResult => ({
    changePercent: '0.48',
    dayHigh: '10.6',
    dayLow: '10.4',
    logoUrl: null,
    name: null,
    previousClose: '10.48',
    price: '10.53',
    quotedAt: new Date('2026-11-04T16:00:00Z'),
    ticker,
    ...overrides,
  }),
};

export let setup: QuoteFetcher;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      QuoteFetcher,
      { provide: 'IBrapiQuotes', useValue: spies.brapi },
      { provide: 'IFinnhubQuotes', useValue: spies.finnhub },
      { provide: 'IFxRates', useValue: spies.fx },
      { provide: 'IQuoteRepository', useValue: spies.repository },
      { provide: 'ILogger', useValue: spies.logger },
      { provide: EnvService, useValue: { investmentQuotesBrapiBatchSize: 20 } },
    ],
  }).compile();

  setup = module.get(QuoteFetcher);
});
