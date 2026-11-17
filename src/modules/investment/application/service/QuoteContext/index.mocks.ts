import { IndexSeriesLoader } from '@investment/application/service/IndexSeriesLoader';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { TickerValidator } from '@investment/application/service/TickerValidator';

// Providers the use cases of spec 104 need, as inert mocks for their unit tests.
export const quoteSpies = {
  findFx: jest.fn(),
  findFxOnOrBefore: jest.fn(),
  load: jest.fn(),
  loadIndexes: jest.fn(),
  validate: jest.fn(),
};

export const quoteProviders = [
  { provide: IndexSeriesLoader, useValue: { load: quoteSpies.loadIndexes } },
  { provide: QuoteContextLoader, useValue: { load: quoteSpies.load } },
  { provide: TickerValidator, useValue: { validate: quoteSpies.validate } },
  {
    provide: 'IQuoteRepository',
    useValue: { findFx: quoteSpies.findFx, findFxOnOrBefore: quoteSpies.findFxOnOrBefore },
  },
];
