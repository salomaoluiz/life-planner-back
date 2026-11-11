import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';

import { CorporateEventRepository } from './index';

const names = [
  'countPendingByAsset',
  'createSuggestions',
  'findEvents',
  'findPendingSuggestions',
  'findSuggestionById',
  'findSuggestionInputs',
  'rejectSuggestion',
  'runExclusive',
  'upsertEvents',
] as const;

export const spies = Object.fromEntries(names.map((name) => [name, jest.fn()])) as Record<
  (typeof names)[number],
  jest.Mock
>;

const event = {
  bonus_percent: new Prisma.Decimal('10'),
  bonus_unit_cost: null,
  currency: 'BRL',
  event_key: 'k',
  fetched_at: new Date('2026-11-11T22:00:00Z'),
  id: 'ev-1',
  market: 'B3' as const,
  ratio_from: null,
  ratio_to: null,
  record_date: new Date('2026-11-18T00:00:00Z'),
  source: 'brapi',
  ticker: 'MGLU3',
  type: 'BONUS' as const,
};

export const mocks = {
  event,
  suggestion: {
    asset_id: 'asset-1',
    created_at: new Date('2026-11-19T00:00:00Z'),
    decided_at: null,
    decided_by: null,
    event,
    event_id: 'ev-1',
    id: 'sug-1',
    quantity: new Prisma.Decimal('315'),
    status: 'PENDING' as const,
  },
};

export let setup: CorporateEventRepository;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CorporateEventRepository,
      { provide: 'ICorporateEventDatasource', useValue: spies },
    ],
  }).compile();

  setup = module.get(CorporateEventRepository);
});
