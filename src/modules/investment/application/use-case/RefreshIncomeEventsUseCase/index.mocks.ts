import { Test } from '@nestjs/testing';

import {
  incomeEventFixture,
  incomeRepositorySpies,
} from '@investment/domain/entity/mocks/income.fixture';
import { quoteRepositorySpies } from '@investment/domain/entity/mocks/investment.fixture';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';

import { RefreshIncomeEventsUseCase } from './index';

export const spies = {
  brapi: { getIncomeEvents: jest.fn() },
  finnhub: { getIncomeEvents: jest.fn() },
  incomes: incomeRepositorySpies(),
  logger: { log: jest.fn() },
  quotes: quoteRepositorySpies(),
};

export const mocks = {
  brapiEvent: {
    amountPerUnit: '0.47',
    currency: 'BRL',
    exDate: '2026-11-21',
    paymentDate: '2026-12-19',
    ticker: 'ITSA4',
    type: 'DIVIDEND' as const,
  },
  buy: {
    createdAt: new Date('2026-01-01T00:00:00Z'),
    date: '2026-01-10',
    id: 'op-1',
    quantity: '300.00000000',
    total: 100000,
    type: 'BUY',
  },
  event: incomeEventFixture({ id: 'ev-1', ticker: 'ITSA4' }),
  tracked: [{ fetchedAt: null, market: QuoteMarket.B3, ticker: 'ITSA4' }],
};

export let setup: RefreshIncomeEventsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  spies.incomes.runExclusive.mockImplementation(async (_key: number, fn: () => Promise<void>) => {
    await fn();
    return true;
  });
  spies.quotes.findTrackedSymbols.mockResolvedValue(mocks.tracked);
  spies.brapi.getIncomeEvents.mockResolvedValue([mocks.brapiEvent]);
  spies.incomes.upsertEvents.mockImplementation(async (rows: unknown[]) => rows);
  spies.incomes.findEvents.mockResolvedValue([mocks.event]);
  spies.incomes.findSuggestionInputs.mockResolvedValue({
    assets: [
      { assetId: 'asset-1', market: QuoteMarket.B3, operations: [mocks.buy], ticker: 'ITSA4' },
    ],
    existing: [],
    incomes: [],
  });
  spies.incomes.createSuggestions.mockResolvedValue(1);

  const module = await Test.createTestingModule({
    providers: [
      RefreshIncomeEventsUseCase,
      { provide: 'IQuoteRepository', useValue: spies.quotes },
      { provide: 'IIncomeRepository', useValue: spies.incomes },
      { provide: 'IBrapiQuotes', useValue: spies.brapi },
      { provide: 'IFinnhubQuotes', useValue: spies.finnhub },
      { provide: 'ILogger', useValue: spies.logger },
    ],
  }).compile();

  setup = module.get(RefreshIncomeEventsUseCase);
});
