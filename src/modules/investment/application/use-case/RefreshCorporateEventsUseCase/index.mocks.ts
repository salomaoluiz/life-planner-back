import { Test } from '@nestjs/testing';

import {
  corporateEventFixture,
  corporateEventRepositorySpies,
} from '@investment/domain/entity/mocks/corporateEvent.fixture';
import { quoteRepositorySpies } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

import { RefreshCorporateEventsUseCase } from './index';

export const spies = {
  brapi: { getCorporateEvents: jest.fn() },
  events: corporateEventRepositorySpies(),
  finnhub: { getCorporateEvents: jest.fn() },
  logger: { log: jest.fn() },
  quotes: quoteRepositorySpies(),
};

export const mocks = {
  brapiEvent: {
    bonusPercent: '10',
    currency: 'BRL',
    recordDate: '2026-11-18',
    ticker: 'MGLU3',
    type: 'BONUS' as const,
  },
  buy: {
    createdAt: new Date('2026-01-01T00:00:00Z'),
    date: '2026-01-10',
    id: 'op-1',
    quantity: Decimal8.parse('315'),
    total: 318594,
    type: InvestmentOperationType.BUY,
  },
  event: corporateEventFixture({
    bonusPercent: '10',
    id: 'ev-1',
    ratioFrom: null,
    ratioTo: null,
    recordDate: '2026-11-18',
    type: 'BONUS' as never,
  }),
  tracked: [{ fetchedAt: null, market: QuoteMarket.B3, ticker: 'MGLU3' }],
};

export function inputsOf(operations: unknown[]) {
  return {
    assets: [
      {
        assetClass: InvestmentAssetClass.BR_STOCK,
        assetId: 'asset-1',
        market: QuoteMarket.B3,
        operations,
        ticker: 'MGLU3',
      },
    ],
    existing: [] as string[],
  };
}

export let setup: RefreshCorporateEventsUseCase;

beforeEach(async () => {
  jest.resetAllMocks();
  spies.events.runExclusive.mockImplementation(async (_key: number, fn: () => Promise<void>) => {
    await fn();
    return true;
  });
  spies.quotes.findTrackedSymbols.mockResolvedValue(mocks.tracked);
  spies.brapi.getCorporateEvents.mockResolvedValue([mocks.brapiEvent]);
  spies.events.upsertEvents.mockImplementation(async (rows: unknown[]) => rows.length);
  spies.events.findEvents.mockResolvedValue([mocks.event]);
  spies.events.findSuggestionInputs.mockResolvedValue(inputsOf([mocks.buy]));
  spies.events.createSuggestions.mockResolvedValue(1);

  const module = await Test.createTestingModule({
    providers: [
      RefreshCorporateEventsUseCase,
      { provide: 'IQuoteRepository', useValue: spies.quotes },
      { provide: 'ICorporateEventRepository', useValue: spies.events },
      { provide: 'IBrapiQuotes', useValue: spies.brapi },
      { provide: 'IFinnhubQuotes', useValue: spies.finnhub },
      { provide: 'ILogger', useValue: spies.logger },
    ],
  }).compile();

  setup = module.get(RefreshCorporateEventsUseCase);
});
