import { Test } from '@nestjs/testing';

import { SearchTickersUseCase } from './index';

export const spies = {
  brapi: { search: jest.fn() },
  finnhub: { search: jest.fn() },
};

export const mocks = {
  result: {
    changePercent: '0.48',
    logoUrl: 'https://example.com/logo.svg',
    name: 'Itausa PN',
    price: '10.53',
    quotedAt: new Date(),
    ticker: 'ITSA4',
  },
};

export let setup: SearchTickersUseCase;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      SearchTickersUseCase,
      { provide: 'IBrapiQuotes', useValue: spies.brapi },
      { provide: 'IFinnhubQuotes', useValue: spies.finnhub },
    ],
  }).compile();

  setup = module.get(SearchTickersUseCase);
});
