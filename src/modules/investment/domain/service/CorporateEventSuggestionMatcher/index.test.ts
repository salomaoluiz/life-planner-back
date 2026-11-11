import { InvestmentCorporateEventType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';

import {
  CorporateMatcherAsset,
  CorporateMatcherEvent,
  MatchEventsInput,
  matchEventSuggestions,
} from './index';

function asset(overrides: Partial<CorporateMatcherAsset> = {}): CorporateMatcherAsset {
  return {
    firstBuyDate: '2026-01-10',
    id: 'asset-1',
    market: QuoteMarket.B3,
    positionAt: () => Decimal8.parse('315'),
    ticker: 'MGLU3',
    ...overrides,
  };
}
function event(overrides: Partial<CorporateMatcherEvent> = {}): CorporateMatcherEvent {
  return {
    id: 'ev-1',
    market: QuoteMarket.B3,
    recordDate: '2026-11-18',
    ticker: 'MGLU3',
    type: InvestmentCorporateEventType.BONUS,
    ...overrides,
  };
}
function run(overrides: Partial<MatchEventsInput> = {}) {
  return matchEventSuggestions({
    assets: [asset()],
    entered: [],
    events: [event()],
    existing: new Set<string>(),
    today: '2026-11-19',
    ...overrides,
  });
}

describe('matchEventSuggestions', () => {
  it('SHOULD suggest an event from the day after its data-com with the position of that day', () => {
    const result = run();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ assetId: 'asset-1', eventId: 'ev-1' });
    expect(result[0].quantity.toString()).toBe('315');
  });

  it('SHOULD wait WHEN the data-com is today or in the future', () => {
    expect(run({ today: '2026-11-18' })).toEqual([]);
    expect(run({ today: '2026-11-10' })).toEqual([]);
  });

  it('SHOULD skip a data-com before the first buy or older than 12 months', () => {
    expect(run({ assets: [asset({ firstBuyDate: '2026-11-19' })] })).toEqual([]);
    expect(run({ assets: [asset({ firstBuyDate: null })] })).toEqual([]);
    expect(run({ events: [event({ recordDate: '2025-11-01' })] })).toEqual([]);
  });

  it('SHOULD skip another ticker or market', () => {
    expect(run({ events: [event({ ticker: 'ITSA4' })] })).toEqual([]);
    expect(run({ events: [event({ market: QuoteMarket.US })] })).toEqual([]);
  });

  it('SHOULD skip a suggestion that already exists in any state', () => {
    expect(run({ existing: new Set(['asset-1:ev-1']) })).toEqual([]);
  });

  it('SHOULD skip WHEN no shares were held at the data-com', () => {
    expect(run({ assets: [asset({ positionAt: () => Decimal8.zero() })] })).toEqual([]);
  });

  it('SHOULD skip WHEN the same type was entered by hand within 3 days of the data-com', () => {
    const entered = [
      { assetId: 'asset-1', date: '2026-11-20', type: InvestmentCorporateEventType.BONUS },
    ];

    expect(run({ entered })).toEqual([]);
    expect(run({ entered: [{ ...entered[0], date: '2026-11-21' }] })).toEqual([]);
    expect(run({ entered: [{ ...entered[0], date: '2026-11-15' }] })).toEqual([]);
  });

  it('SHOULD still suggest WHEN the hand entry is 4 days away, another type or another asset', () => {
    const bonus = InvestmentCorporateEventType.BONUS;

    expect(
      run({ entered: [{ assetId: 'asset-1', date: '2026-11-22', type: bonus }] }),
    ).toHaveLength(1);
    expect(
      run({ entered: [{ assetId: 'asset-1', date: '2026-11-23', type: bonus }] }),
    ).toHaveLength(1);
    expect(
      run({
        entered: [
          { assetId: 'asset-1', date: '2026-11-18', type: InvestmentCorporateEventType.SPLIT },
          { assetId: 'other', date: '2026-11-18', type: bonus },
        ],
      }),
    ).toHaveLength(1);
  });
});
