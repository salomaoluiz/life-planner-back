import { Test } from '@nestjs/testing';

import {
  assetFixture,
  quoteFixture,
  quoteRepositorySpies,
} from '@investment/domain/entity/mocks/investment.fixture';

import { emptyContext, QuoteContextLoader, quoteKey } from './index';

const spies = quoteRepositorySpies();
let setup: QuoteContextLoader;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [QuoteContextLoader, { provide: 'IQuoteRepository', useValue: spies }],
  }).compile();

  setup = module.get(QuoteContextLoader);
});

describe('QuoteContextLoader.load', () => {
  it('SHOULD read the quotes of the quoted assets in ONE query AND skip the rate for BRL assets', async () => {
    spies.findQuotes.mockResolvedValue([quoteFixture()]);

    const context = await setup.load([
      assetFixture(),
      assetFixture({ ticker: 'ITSA4' }),
      assetFixture({ assetClass: 'FIXED_INCOME' as never, ticker: null }),
    ]);

    expect(spies.findQuotes).toHaveBeenCalledTimes(1);
    expect(spies.findQuotes).toHaveBeenCalledWith([{ market: 'B3', ticker: 'ITSA4' }]);
    expect(spies.findFx).not.toHaveBeenCalled();
    expect(context.quotes.get(quoteKey('B3', 'ITSA4'))?.price.toString()).toBe('10.53');
    expect(context.fx).toBeNull();
  });

  it('SHOULD read the USD-BRL rate WHEN there is a USD asset', async () => {
    spies.findQuotes.mockResolvedValue([]);
    spies.findFx.mockResolvedValue({
      pair: 'USD-BRL',
      quotedAt: new Date(),
      rate: '5.56',
      source: 'BRAPI',
    });

    const context = await setup.load([
      assetFixture({ assetClass: 'FOREIGN_STOCK' as never, currency: 'USD', ticker: 'AAPL' }),
    ]);

    expect(spies.findFx).toHaveBeenCalledWith('USD-BRL');
    expect(context.fx?.rate).toBe('5.56');
  });

  it('SHOULD make NO query WHEN nothing is quoted and nothing is in USD', async () => {
    const context = await setup.load([
      assetFixture({ assetClass: 'PRIVATE' as never, ticker: null }),
    ]);

    expect(spies.findQuotes).not.toHaveBeenCalled();
    expect(context.quotes.size).toBe(0);
    expect(emptyContext().fx).toBeNull();
  });
});
