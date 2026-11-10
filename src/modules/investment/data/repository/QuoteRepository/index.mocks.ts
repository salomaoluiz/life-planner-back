import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';

import { QuoteRepository } from './index';

const names = [
  'findFx',
  'findFxHistory',
  'findFxOnOrBefore',
  'findHistory',
  'findQuotes',
  'findTrackedSymbols',
  'hasHistory',
  'markMissing',
  'markQuoteErrors',
  'runExclusive',
  'saveFx',
  'saveFxHistory',
  'saveHistory',
  'saveQuotes',
] as const;

export const spies = Object.fromEntries(names.map((name) => [name, jest.fn()])) as Record<
  (typeof names)[number],
  jest.Mock
>;

export const mocks = {
  decimal: (value: string) => new Prisma.Decimal(value),
  quoteRow: {
    change_percent: null,
    currency: 'BRL',
    day_high: null,
    day_low: null,
    fetched_at: new Date('2026-11-04T16:05:00Z'),
    id: 'q',
    last_error_at: null,
    logo_url: null,
    market: 'B3',
    missing_days: 0,
    name: null,
    previous_close: null,
    price: new Prisma.Decimal('10.53'),
    quoted_at: new Date('2026-11-04T16:00:00Z'),
    source: 'BRAPI',
    ticker: 'ITSA4',
    unavailable: false,
  },
};

export let setup: QuoteRepository;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [QuoteRepository, { provide: 'IQuoteDatasource', useValue: spies }],
  }).compile();

  setup = module.get(QuoteRepository);
});
