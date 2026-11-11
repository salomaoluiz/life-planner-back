import { InvestmentIncomeType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

import {
  MatcherAsset,
  MatcherEvent,
  MatcherIncome,
  matchSuggestions,
  suggestionKey,
} from './index';

const TODAY = '2026-11-10';

function asset(overrides: Partial<MatcherAsset> = {}): MatcherAsset {
  return {
    firstBuyDate: '2026-01-10',
    id: 'asset-1',
    market: QuoteMarket.B3,
    positionAt: () => Decimal8.parse('300'),
    ticker: 'PETR4',
    ...overrides,
  };
}
function event(overrides: Partial<MatcherEvent> = {}): MatcherEvent {
  return {
    exDate: '2026-11-21',
    id: 'event-1',
    market: QuoteMarket.B3,
    paymentDate: '2026-12-19',
    ticker: 'PETR4',
    type: InvestmentIncomeType.DIVIDEND,
    ...overrides,
  };
}
function run(
  parts: {
    assets?: MatcherAsset[];
    events?: MatcherEvent[];
    existing?: string[];
    incomes?: MatcherIncome[];
  } = {},
) {
  return matchSuggestions({
    assets: parts.assets ?? [asset()],
    events: parts.events ?? [event()],
    existing: new Set(parts.existing ?? []),
    incomes: parts.incomes ?? [],
    today: TODAY,
  });
}

describe('matchSuggestions', () => {
  it('SHOULD suggest the event with the quantity held at the ex-date', () => {
    const [suggestion] = run();

    expect(suggestion).toMatchObject({ assetId: 'asset-1', eventId: 'event-1' });
    expect(suggestion.quantity.toString()).toBe('300');
  });

  it('SHOULD skip WHEN the ex-date is before the first buy', () => {
    expect(run({ assets: [asset({ firstBuyDate: '2026-12-01' })] })).toEqual([]);
  });

  it('SHOULD skip WHEN the ex-date is more than 12 months old', () => {
    const old = asset({ firstBuyDate: '2024-01-10' });

    expect(run({ assets: [old], events: [event({ exDate: '2025-11-09' })] })).toEqual([]);
    expect(run({ assets: [old], events: [event({ exDate: '2025-11-10' })] })).toHaveLength(1);
  });

  it('SHOULD skip WHEN the position at the ex-date is zero', () => {
    expect(run({ assets: [asset({ positionAt: () => Decimal8.zero() })] })).toEqual([]);
  });

  it('SHOULD skip an asset without operations', () => {
    expect(run({ assets: [asset({ firstBuyDate: null })] })).toEqual([]);
  });

  it('SHOULD skip WHEN a suggestion exists in any state', () => {
    expect(run({ existing: [suggestionKey('asset-1', 'event-1')] })).toEqual([]);
  });

  it('SHOULD skip WHEN an income of the same type has the same ex-date', () => {
    const income = {
      assetId: 'asset-1',
      exDate: '2026-11-21',
      paymentDate: '2026-12-01',
      type: InvestmentIncomeType.DIVIDEND,
    };

    expect(run({ incomes: [income] })).toEqual([]);
    expect(run({ incomes: [{ ...income, type: InvestmentIncomeType.JCP }] })).toHaveLength(1);
  });

  it('SHOULD skip WHEN an income without ex-date is paid within 3 days of the event payment', () => {
    const income = {
      assetId: 'asset-1',
      exDate: null,
      paymentDate: '2026-12-22',
      type: InvestmentIncomeType.DIVIDEND,
    };

    expect(run({ incomes: [income] })).toEqual([]);
    expect(run({ incomes: [{ ...income, paymentDate: '2026-12-23' }] })).toHaveLength(1);
  });

  it('SHOULD not match an event of another ticker or market', () => {
    expect(run({ events: [event({ ticker: 'VALE3' })] })).toEqual([]);
    expect(run({ events: [event({ market: QuoteMarket.US })] })).toEqual([]);
  });
});
