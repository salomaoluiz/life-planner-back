import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';

import { IncomeRepository } from './index';

const names = [
  'countPendingSuggestions',
  'createSuggestions',
  'deleteIncome',
  'findCategoryById',
  'findDefaultAccountId',
  'findEvents',
  'findIncomeById',
  'findIncomeByTransactionId',
  'findIncomes',
  'findLastIncomeCategoryId',
  'findPendingSuggestions',
  'findSuggestionById',
  'findSuggestionInputs',
  'incomeTotals',
  'rejectSuggestion',
  'runExclusive',
  'upsertEvents',
  'writeIncome',
] as const;

export const spies = Object.fromEntries(names.map((name) => [name, jest.fn()])) as Record<
  (typeof names)[number],
  jest.Mock
>;

const event = {
  amount_per_unit: new Prisma.Decimal('0.47'),
  currency: 'BRL',
  ex_date: new Date('2026-11-21T00:00:00Z'),
  id: 'ev-1',
  market: 'B3',
  payment_date: null,
  source: 'brapi',
  ticker: 'PETR4',
  type: 'DIVIDEND',
};

export const mocks = {
  event,
  incomeRow: {
    amount_per_unit: null,
    asset: { asset_class: 'BR_STOCK' },
    asset_id: 'asset-1',
    created_at: new Date('2026-10-30T00:00:00Z'),
    created_by: 'user-1',
    currency: 'BRL',
    ex_date: null,
    id: 'inc-1',
    net_amount: 7140,
    notes: null,
    payment_date: new Date('2026-10-30T00:00:00Z'),
    quantity: null,
    suggestion_id: null,
    transaction: { account_id: 'acc-1', category_id: 'cat-1', paid: true },
    transaction_id: 'tx-1',
    type: 'JCP',
    updated_at: new Date('2026-10-30T00:00:00Z'),
  },
};

export let setup: IncomeRepository;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [IncomeRepository, { provide: 'IIncomeDatasource', useValue: spies }],
  }).compile();

  setup = module.get(IncomeRepository);
});
