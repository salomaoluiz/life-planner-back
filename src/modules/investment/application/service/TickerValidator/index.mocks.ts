import { Test } from '@nestjs/testing';

import { HistoryBackfill } from '@investment/application/service/HistoryBackfill';
import { QuoteFetcher } from '@investment/application/service/QuoteFetcher';

import { TickerValidator } from './index';

export const spies = {
  backfill: { queue: jest.fn() },
  brapi: { getQuotes: jest.fn() },
  fetcher: { save: jest.fn() },
  finnhub: { getQuotes: jest.fn() },
};

export let setup: TickerValidator;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      TickerValidator,
      { provide: 'IBrapiQuotes', useValue: spies.brapi },
      { provide: 'IFinnhubQuotes', useValue: spies.finnhub },
      { provide: QuoteFetcher, useValue: spies.fetcher },
      { provide: HistoryBackfill, useValue: spies.backfill },
    ],
  }).compile();

  setup = module.get(TickerValidator);
});
